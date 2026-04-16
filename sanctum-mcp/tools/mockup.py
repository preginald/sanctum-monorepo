"""MCP tools for pushing and listing mockup artefacts."""

import json
import re
from datetime import datetime, timezone
from app import mcp
from cost_tiers import HEAVY_WRITE, LIGHT_READ
from telemetry import with_telemetry
import client

# Valid enum values for annotation fields
_ANNOTATION_TYPES = {"design_intent", "constraint", "interaction", "token_ref", "todo"}
_ANNOTATION_PRIORITIES = {"low", "normal", "high"}

# Robust extension mapping from mime_type to file extension
_EXT_MAP = {
    "text/jsx": ".jsx",
    "text/tsx": ".tsx",
    "text/html": ".html",
    "text/css": ".css",
    "application/json": ".json",
    "text/javascript": ".js",
    "text/typescript": ".ts",
}


def _slugify(label: str) -> str:
    """Convert a version label to a filename-safe slug."""
    slug = label.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "mockup"


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def mockup_push(
    source: str,
    ticket_id: int,
    version_label: str,
    mime_type: str = "text/jsx",
    design_system_refs: list[str] | None = None,
) -> str:
    """Push a mockup source file to a ticket as an artefact with handoff comment.

    Creates an artefact containing the mockup source code, links it to the
    specified ticket, and posts a structured handoff comment with integration
    instructions.

    Args:
        source: The full source code of the mockup component.
        ticket_id: The ticket number to attach the mockup to.
        version_label: Human-readable version label (e.g. "v1-light-tailwind").
        mime_type: MIME type of the source (default "text/jsx").
        design_system_refs: Optional list of design system reference strings
            (e.g. ["Tailwind CSS", "shadcn/ui"]).
    """
    # 1. Derive filename from version_label
    slug = _slugify(version_label)
    ext = _EXT_MAP.get(mime_type, ".jsx")
    filename = f"{slug}{ext}"

    # 2. Create artefact
    artefact_payload = {
        "name": f"Mockup: {version_label} (#{ticket_id})",
        "artefact_type": "document",
        "category": "mockup",
        "content": source,
        "mime_type": mime_type,
        "sensitivity": "internal",
        "metadata": {
            "version_label": version_label,
            "design_system_refs": design_system_refs or [],
        },
    }
    artefact_result = await client.post("/artefacts", json=artefact_payload)
    artefact_id = artefact_result.get("id")
    if not artefact_id:
        return json.dumps({
            "error": "Failed to create artefact",
            "detail": artefact_result,
        }, indent=2)

    # 3. Link artefact to ticket
    link_payload = {
        "entity_type": "ticket",
        "entity_id": str(ticket_id),
    }
    link_ok = True
    try:
        await client.post(f"/artefacts/{artefact_id}/link", json=link_payload)
    except Exception:
        link_ok = False

    # 4. Build handoff comment
    ds_section = ""
    if design_system_refs:
        refs = ", ".join(design_system_refs)
        ds_section = f"\n**Design system:** {refs}\n"

    comment_body = (
        f"## Mockup Handoff -- {version_label}\n\n"
        f"**Artefact:** `{artefact_id}`\n"
        f"**File:** `mockups/{filename}`\n"
        f"**MIME:** `{mime_type}`\n"
        f"{ds_section}"
        f"\n### Integration Steps\n\n"
        f"1. Save artefact content to `mockups/{filename}`\n"
        f"2. Install any missing dependencies from the design system refs\n"
        f"3. Wire up routing / embed in target page\n"
        f"4. Replace placeholder data with live API calls\n"
    )

    # 5. Post comment to ticket
    comment_payload = {
        "body": comment_body,
        "visibility": "internal",
        "ticket_id": ticket_id,
    }
    comment_result = await client.post("/comments", json=comment_payload)
    comment_id = comment_result.get("id")

    # 6. Return summary
    result = {
        "artefact_id": artefact_id,
        "comment_id": comment_id,
        "filename": filename,
        "version_label": version_label,
        "ticket_id": ticket_id,
    }
    if not link_ok:
        result["warning"] = "Artefact created but link to ticket failed"
    return json.dumps(result, indent=2)


# Regex for extracting version_label from legacy artefact names
_NAME_RE = re.compile(r"^Mockup:\s+(.+?)\s+\(#\d+\)$")


def _extract_version_label(artefact: dict) -> str | None:
    """Extract version_label from metadata, falling back to name parsing."""
    meta = artefact.get("metadata") or {}
    if isinstance(meta, dict) and meta.get("version_label"):
        return meta["version_label"]
    # Fallback: parse from name pattern "Mockup: {label} (#{id})"
    name = artefact.get("name", "")
    m = _NAME_RE.match(name)
    return m.group(1) if m else None


def _summarise(artefact: dict) -> dict:
    """Build a summary dict for a mockup artefact."""
    meta = artefact.get("metadata") or {}
    if not isinstance(meta, dict):
        meta = {}
    return {
        "id": artefact.get("id"),
        "name": artefact.get("name"),
        "mime_type": artefact.get("mime_type"),
        "created_at": artefact.get("created_at"),
        "version_label": _extract_version_label(artefact),
        "design_system_refs": meta.get("design_system_refs") or None,
    }


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def mockup_list(
    ticket_id: int | None = None,
) -> str:
    """List mockup artefacts linked to a ticket, or all mockups for the account.

    Args:
        ticket_id: Filter to mockups linked to this ticket.
            If omitted, returns all mockup artefacts.
    """
    if ticket_id is not None:
        ticket = await client.get(
            f"/tickets/{ticket_id}", params={"expand": "artefacts"}
        )
        all_artefacts = ticket.get("artefacts", []) if isinstance(ticket, dict) else []
        mockups = [a for a in all_artefacts if a.get("category") == "mockup"]
    else:
        result = await client.get("/artefacts", params={"category": "mockup"})
        mockups = result if isinstance(result, list) else []

    return json.dumps([_summarise(a) for a in mockups], indent=2)


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def mockup_annotate(
    artefact_id: str,
    element: str,
    note: str,
    annotation_type: str = "design_intent",
    priority: str = "normal",
) -> str:
    """Add an annotation to a mockup artefact.

    Annotations are stored in the artefact's metadata and accumulate over
    multiple calls.  Each annotation is assigned a monotonically increasing
    ID via the ``annotation_seq`` counter.

    Args:
        artefact_id: UUID of the mockup artefact to annotate.
        element: Component name or CSS selector identifying the annotated element.
        note: Free-text annotation body (required, must not be empty).
        annotation_type: One of ``design_intent``, ``constraint``,
            ``interaction``, ``token_ref``, ``todo``.
        priority: One of ``low``, ``normal``, ``high`` (default ``normal``).
    """
    # Validate enums (O4)
    if annotation_type not in _ANNOTATION_TYPES:
        return json.dumps({
            "error": f"Invalid annotation_type '{annotation_type}'",
            "valid": sorted(_ANNOTATION_TYPES),
        }, indent=2)
    if priority not in _ANNOTATION_PRIORITIES:
        return json.dumps({
            "error": f"Invalid priority '{priority}'",
            "valid": sorted(_ANNOTATION_PRIORITIES),
        }, indent=2)
    # Validate note is non-empty (O1)
    if not note or not note.strip():
        return json.dumps({"error": "note must not be empty"}, indent=2)

    # GET-merge-PUT cycle to append annotation without overwriting.
    # NOTE: This is NOT atomic.  If two concurrent annotate calls race on the
    # same artefact, the second PUT may overwrite the first's annotation.
    # A proper fix requires server-side PATCH/append support.  (O2)
    artefact = await client.get(f"/artefacts/{artefact_id}")
    if not isinstance(artefact, dict) or not artefact.get("id"):
        return json.dumps({
            "error": f"Artefact {artefact_id} not found",
            "detail": artefact,
        }, indent=2)

    meta = artefact.get("metadata") or {}
    if not isinstance(meta, dict):
        meta = {}

    annotations = meta.get("annotations", [])
    if not isinstance(annotations, list):
        annotations = []

    # Monotonic counter (O3) — survives deletions unlike len(annotations)
    seq = meta.get("annotation_seq", 0) + 1

    annotation = {
        "id": seq,
        "element": element,
        "annotation_type": annotation_type,
        "note": note.strip(),
        "priority": priority,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    annotations.append(annotation)
    meta["annotations"] = annotations
    meta["annotation_seq"] = seq

    await client.put(f"/artefacts/{artefact_id}", json={"metadata": meta})

    return json.dumps({
        "annotation_id": seq,
        "artefact_id": artefact_id,
        "element": element,
        "annotation_type": annotation_type,
        "priority": priority,
        "total_annotations": len(annotations),
    }, indent=2)


@mcp.tool(annotations=LIGHT_READ)
@with_telemetry("light")
async def mockup_annotate_list(
    artefact_id: str,
    element: str | None = None,
    annotation_type: str | None = None,
) -> str:
    """List annotations on a mockup artefact.

    Args:
        artefact_id: UUID of the mockup artefact.
        element: Optional filter — only return annotations for this element.
        annotation_type: Optional filter — only return annotations of this type.
    """
    artefact = await client.get(f"/artefacts/{artefact_id}")
    if not isinstance(artefact, dict) or not artefact.get("id"):
        return json.dumps({
            "error": f"Artefact {artefact_id} not found",
            "detail": artefact,
        }, indent=2)

    meta = artefact.get("metadata") or {}
    if not isinstance(meta, dict):
        meta = {}
    annotations = meta.get("annotations", [])
    if not isinstance(annotations, list):
        annotations = []

    # Apply optional filters
    if element is not None:
        annotations = [a for a in annotations if a.get("element") == element]
    if annotation_type is not None:
        annotations = [a for a in annotations if a.get("annotation_type") == annotation_type]

    # Group by element for the response
    grouped: dict[str, list[dict]] = {}
    for a in annotations:
        el = a.get("element", "unknown")
        grouped.setdefault(el, []).append(a)

    return json.dumps({
        "artefact_id": artefact_id,
        "total": len(annotations),
        "by_element": grouped,
    }, indent=2)


def _generate_annotation_panel_jsx(annotations_by_version: dict[str, list[dict]]) -> str:
    """Generate the ANNOTATIONS constant and AnnotationPanel component for the viewer.

    Returns a JS code block containing:
    - ``ANNOTATIONS`` — a map from version short_id to its annotation list
    - ``AnnotationPanel`` — a collapsible React component that renders
      annotations grouped by element, colour-coded by type, with priority badges.

    The panel is rendered *below* each mockup column so it does not obscure
    the mockup content.  (O5)

    Args:
        annotations_by_version: Map of version short_id to list of annotation dicts.
    """
    # Serialise the annotations map as a JS constant
    annotations_json = json.dumps(annotations_by_version, indent=2)

    return f"""
const ANNOTATIONS = {annotations_json};

const TYPE_COLORS = {{
  design_intent: "#5c6ff2",
  constraint: "#ef4444",
  interaction: "#22c55e",
  token_ref: "#a855f7",
  todo: "#f59e0b",
}};

function AnnotationPanel({{ versionId }}) {{
  const [open, setOpen] = useState(false);
  const anns = ANNOTATIONS[versionId] || [];
  if (anns.length === 0) return null;

  // Group by element
  const grouped = {{}};
  anns.forEach(a => {{
    const el = a.element || "unknown";
    if (!grouped[el]) grouped[el] = [];
    grouped[el].push(a);
  }});

  return (
    <div style={{{{ borderTop: `1px solid ${{C.border}}`, marginTop: 0 }}}}>
      <button
        onClick={{() => setOpen(o => !o)}}
        style={{{{
          width: "100%", padding: "8px 16px", background: "transparent",
          border: "none", color: C.textDim, fontSize: 11, cursor: "pointer",
          textAlign: "left", fontFamily: "inherit",
        }}}}
      >
        {{open ? "\\u25bc" : "\\u25b6"}} Annotations ({{anns.length}})
      </button>
      {{open && (
        <div style={{{{ padding: "0 16px 16px", maxHeight: 400, overflowY: "auto" }}}}>
          {{Object.entries(grouped).map(([el, items]) => (
            <div key={{el}} style={{{{ marginBottom: 12 }}}}>
              <div style={{{{ fontSize: 11, fontWeight: 600, color: "#a3a3a3", marginBottom: 6, fontFamily: "monospace" }}}}>{{el}}</div>
              {{items.map(a => (
                <div key={{a.id}} style={{{{ borderLeft: `3px solid ${{TYPE_COLORS[a.annotation_type] || "#737373"}}`, paddingLeft: 10, marginBottom: 8 }}}}>
                  <div style={{{{ display: "flex", alignItems: "center", gap: 6 }}}}>
                    <span style={{{{ fontSize: 10, color: TYPE_COLORS[a.annotation_type] || "#737373", fontWeight: 600, textTransform: "uppercase" }}}}>{{a.annotation_type}}</span>
                    {{a.priority === "high" && <span style={{{{ color: "#ef4444", fontSize: 10, fontWeight: 700, marginLeft: 8 }}}}>\\u25cf HIGH</span>}}
                    {{a.priority === "low" && <span style={{{{ color: "#737373", fontSize: 10, marginLeft: 8 }}}}>\\u25cb low</span>}}
                  </div>
                  <div style={{{{ fontSize: 12, color: C.text, marginTop: 2 }}}}>{{a.note}}</div>
                </div>
              ))}}
            </div>
          ))}}
        </div>
      )}}
    </div>
  );
}}
"""


def _to_pascal_case(label: str) -> str:
    """Convert a version label to a valid JS identifier in PascalCase.

    E.g. "v1-light-tailwind" -> "MockupV1LightTailwind"
    """
    parts = re.split(r"[^a-zA-Z0-9]+", label)
    pascal = "".join(p.capitalize() for p in parts if p)
    return f"Mockup{pascal}" if pascal else "MockupDefault"


def _generate_comparison_jsx(
    versions: list[dict],
    annotations_by_version: dict[str, list[dict]] | None = None,
) -> str:
    """Generate MockupComparison.jsx content from a version manifest.

    Each entry in *versions* must have keys:
        slug          – filename stem (e.g. "v1-light-tailwind")
        version_label – human-readable label
        import_alias  – unique PascalCase identifier
        short_id      – short id for the VERSIONS array (e.g. "v1")

    If *annotations_by_version* is provided, an AnnotationPanel component is
    included and rendered below each mockup column.
    """
    # Build import lines
    import_lines = ['import { useState } from "react";']
    for v in versions:
        import_lines.append(
            f'import {v["import_alias"]} from "./{v["slug"]}";'
        )

    # Build VERSIONS array entries
    version_entries = []
    for v in versions:
        version_entries.append(
            f'  {{ id: "{v["short_id"]}", label: "{v["version_label"]}", '
            f'component: {v["import_alias"]} }},'
        )
    versions_block = "const VERSIONS = [\n" + "\n".join(version_entries) + "\n];"

    # Generate annotation panel code if annotations exist
    annotation_block = ""
    if annotations_by_version:
        annotation_block = _generate_annotation_panel_jsx(annotations_by_version)

    # Static UI shell (copied verbatim from the canonical MockupComparison.jsx)
    ui_shell = r'''
const C = {
  bg: "#0a0a0a",
  surface: "#111",
  border: "#262626",
  borderActive: "#4450e5",
  primary: "#5c6ff2",
  primaryBg: "rgba(68,80,229,0.15)",
  text: "#e5e5e5",
  textMuted: "#525252",
  textDim: "#737373",
  pinned: "#f59e0b",
  pinnedBg: "rgba(245,158,11,0.12)",
  pinnedBorder: "rgba(245,158,11,0.4)",
};

function TabButton({ version, isActive, isPinned, pinCount, onClick, onPin }) {
  const [hovered, setHovered] = useState(false);
  const [pinHovered, setPinHovered] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontSize: 12, padding: "6px 12px", cursor: "pointer", fontWeight: isActive ? 500 : 400,
          transition: "all 0.15s", fontFamily: "inherit",
          borderRadius: isPinned ? "6px 0 0 6px" : 6,
          border: isActive ? `1px solid ${C.borderActive}` : isPinned ? `1px solid ${C.pinnedBorder}` : `1px solid ${C.border}`,
          borderRight: isPinned ? "none" : undefined,
          background: isActive ? C.primaryBg : isPinned ? C.pinnedBg : hovered ? "#1a1a1a" : "transparent",
          color: isActive ? C.primary : isPinned ? C.pinned : hovered ? C.text : C.textDim,
        }}
      >
        {version.label}
      </button>
      <button
        title={isPinned ? "Unpin from comparison" : "Pin for side-by-side comparison"}
        onClick={onPin}
        onMouseEnter={() => setPinHovered(true)}
        onMouseLeave={() => setPinHovered(false)}
        style={{
          fontSize: 11, padding: "6px 7px", cursor: "pointer",
          transition: "all 0.15s", fontFamily: "inherit", lineHeight: 1,
          borderRadius: "0 6px 6px 0",
          border: isPinned ? `1px solid ${C.pinnedBorder}` : `1px solid ${C.border}`,
          borderLeft: `1px solid ${isPinned ? C.pinnedBorder : C.border}`,
          background: isPinned ? C.pinnedBg : pinHovered ? "#1a1a1a" : "transparent",
          color: isPinned ? C.pinned : pinHovered ? C.textDim : "#333",
        }}
      >
        {isPinned ? "\ud83d\udccc" : "\u2295"}
      </button>
    </div>
  );
}

export default function MockupComparison() {
  const [active, setActive] = useState(VERSIONS[0]?.id ?? "v1");
  const [pinned, setPinned] = useState(new Set());

  function togglePin(id) {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Visible columns: pinned versions (in order), or just the active one
  const visibleVersions = pinned.size > 0
    ? VERSIONS.filter(v => pinned.has(v.id))
    : VERSIONS.filter(v => v.id === active);

  const isMultiCol = visibleVersions.length > 1;
  const VIEWPORT_H = "calc(100vh - 57px)";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Toolbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,10,0.96)", backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "10px 20px",
        display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
      }}>
        <span style={{ fontSize: 11, color: C.textMuted, marginRight: 4, fontWeight: 600, letterSpacing: "0.06em" }}>MOCKUP REVIEW</span>

        {VERSIONS.map(v => (
          <TabButton
            key={v.id}
            version={v}
            isActive={active === v.id && pinned.size === 0}
            isPinned={pinned.has(v.id)}
            pinCount={pinned.size}
            onClick={() => { setActive(v.id); setPinned(new Set()); }}
            onPin={() => togglePin(v.id)}
          />
        ))}

        {pinned.size > 0 && (
          <button
            onClick={() => setPinned(new Set())}
            style={{
              fontSize: 11, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
              border: `1px solid ${C.border}`, background: "transparent",
              color: C.textDim, marginLeft: 4, fontFamily: "inherit",
            }}
          >
            ✕ Clear
          </button>
        )}

        <span style={{ fontSize: 11, color: "#333", marginLeft: "auto" }}>
          {pinned.size > 0
            ? `${pinned.size} pinned — side by side`
            : "Pin ⊕ versions to compare side by side"}
        </span>
      </div>

      {/* Content */}
      <div style={{
        display: "flex",
        height: isMultiCol ? VIEWPORT_H : "auto",
        overflow: isMultiCol ? "hidden" : "visible",
      }}>
        {visibleVersions.map((v, i) => (
          <div
            key={v.id}
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: isMultiCol ? "auto" : "visible",
              borderRight: i < visibleVersions.length - 1 ? `1px solid ${C.border}` : "none",
            }}
          >
            {isMultiCol && (
              <div style={{
                position: "sticky", top: 0, zIndex: 10,
                background: "rgba(10,10,10,0.9)", backdropFilter: "blur(4px)",
                borderBottom: `1px solid ${C.border}`,
                padding: "6px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.pinned, letterSpacing: "0.04em" }}>{v.label.toUpperCase()}</span>
                <button
                  onClick={() => togglePin(v.id)}
                  style={{ fontSize: 11, background: "transparent", border: "none", color: "#444", cursor: "pointer", padding: "2px 4px" }}
                >✕</button>
              </div>
            )}
            <v.component />
            <AnnotationPanel versionId={v.id} />
          </div>
        ))}
      </div>
    </div>
  );
}'''

    return (
        "\n".join(import_lines) + "\n\n"
        + versions_block + "\n"
        + annotation_block
        + ui_shell + "\n"
    )


@mcp.tool(annotations=HEAVY_WRITE)
@with_telemetry("heavy")
async def mockup_compare(
    ticket_id: int,
    version_ids: list[str] | None = None,
) -> str:
    """Generate a MockupComparison.jsx wrapper for mockup versions on a ticket.

    Fetches all mockup artefacts linked to the ticket, generates a comparison
    viewer JSX file that imports each version, and stores it as an artefact.
    If a comparison wrapper already exists, it is updated in place.

    Args:
        ticket_id: The ticket number containing mockup artefacts.
        version_ids: Optional list of artefact UUIDs to include.
            If omitted, all mockup artefacts on the ticket are included.
    """
    # 1. Fetch all artefacts on the ticket
    ticket = await client.get(
        f"/tickets/{ticket_id}", params={"expand": "artefacts"}
    )
    all_artefacts = ticket.get("artefacts", []) if isinstance(ticket, dict) else []
    mockups = [a for a in all_artefacts if a.get("category") == "mockup"]

    # 2. Separate comparison-wrapper from version artefacts
    existing_wrapper = None
    version_artefacts = []
    for a in mockups:
        vl = _extract_version_label(a)
        if vl == "comparison-wrapper":
            existing_wrapper = a
        else:
            version_artefacts.append(a)

    # 3. Filter by version_ids if provided
    warnings = []
    if version_ids is not None:
        id_set = set(version_ids)
        filtered = [a for a in version_artefacts if a.get("id") in id_set]
        found_ids = {a.get("id") for a in filtered}
        missing = id_set - found_ids
        if missing:
            warnings.append(f"UUIDs not found on ticket: {', '.join(sorted(missing))}")
        version_artefacts = filtered

    # 4. Guard: no versions found
    if not version_artefacts:
        return json.dumps({
            "error": f"No mockup artefacts found on ticket #{ticket_id}",
            "warnings": warnings,
        }, indent=2)

    # 5. Build version manifest with deduped import aliases
    manifest = []
    seen_aliases = {}
    for idx, a in enumerate(version_artefacts):
        vl = _extract_version_label(a) or f"version-{idx + 1}"
        slug = _slugify(vl)
        mime = a.get("mime_type", "text/jsx")
        ext = _EXT_MAP.get(mime, ".jsx")
        alias = _to_pascal_case(vl)
        # Dedup aliases
        if alias in seen_aliases:
            seen_aliases[alias] += 1
            alias = f"{alias}{seen_aliases[alias]}"
        else:
            seen_aliases[alias] = 1

        manifest.append({
            "slug": f"{slug}{ext}".removesuffix(".jsx"),  # import path without extension for jsx
            "version_label": vl,
            "import_alias": alias,
            "short_id": f"v{idx + 1}",
            "artefact_id": a.get("id"),
        })

    # 5b. Collect annotations for each version artefact
    annotations_by_version: dict[str, list[dict]] = {}
    for entry in manifest:
        a = next(
            (art for art in version_artefacts if art.get("id") == entry["artefact_id"]),
            None,
        )
        if a:
            meta = a.get("metadata") or {}
            if isinstance(meta, dict):
                anns = meta.get("annotations", [])
                if isinstance(anns, list) and anns:
                    annotations_by_version[entry["short_id"]] = anns

    # 6. Generate JSX (with annotations baked in)
    jsx_content = _generate_comparison_jsx(manifest, annotations_by_version or None)

    # 7. Create or update the comparison-wrapper artefact
    artefact_payload = {
        "name": f"Mockup: comparison-wrapper (#{ticket_id})",
        "artefact_type": "document",
        "category": "mockup",
        "content": jsx_content,
        "mime_type": "text/jsx",
        "sensitivity": "internal",
        "metadata": {
            "version_label": "comparison-wrapper",
            "included_versions": [v["artefact_id"] for v in manifest],
        },
    }

    if existing_wrapper:
        artefact_id = existing_wrapper.get("id")
        await client.put(f"/artefacts/{artefact_id}", json=artefact_payload)
        action = "updated"
    else:
        artefact_result = await client.post("/artefacts", json=artefact_payload)
        artefact_id = artefact_result.get("id")
        if not artefact_id:
            return json.dumps({
                "error": "Failed to create comparison wrapper artefact",
                "detail": artefact_result,
            }, indent=2)
        # Link to ticket
        link_payload = {
            "entity_type": "ticket",
            "entity_id": str(ticket_id),
        }
        try:
            await client.post(f"/artefacts/{artefact_id}/link", json=link_payload)
        except Exception:
            warnings.append("Artefact created but link to ticket failed")
        action = "created"

    # 8. Build version table for comment
    version_rows = "\n".join(
        f"| `{v['version_label']}` | `{v['artefact_id']}` | `{v['import_alias']}` |"
        for v in manifest
    )
    warning_section = ""
    if warnings:
        warning_section = "\n**Warnings:**\n" + "\n".join(f"- {w}" for w in warnings) + "\n"

    comment_body = (
        f"## Comparison Wrapper {'Updated' if action == 'updated' else 'Created'}\n\n"
        f"**Artefact:** `{artefact_id}`\n"
        f"**Action:** {action}\n"
        f"**File:** `mockups/MockupComparison.jsx`\n\n"
        f"### Included Versions\n\n"
        f"| Version | Artefact ID | Import Alias |\n"
        f"|---|---|---|\n"
        f"{version_rows}\n\n"
        f"### Integration Steps\n\n"
        f"1. Save artefact content to `mockups/MockupComparison.jsx`\n"
        f"2. Wire up routing:\n"
        f"   ```jsx\n"
        f'   import MockupComparison from "./mockups/MockupComparison";\n'
        f'   <Route path="/mockups" element={{<MockupComparison />}} />\n'
        f"   ```\n"
        f"3. Ensure each version file exists at `mockups/<slug>.jsx`\n"
        f"{warning_section}"
    )

    comment_payload = {
        "body": comment_body,
        "visibility": "internal",
        "ticket_id": ticket_id,
    }
    comment_result = await client.post("/comments", json=comment_payload)
    comment_id = comment_result.get("id")

    # 9. Return summary
    result = {
        "artefact_id": artefact_id,
        "action": action,
        "comment_id": comment_id,
        "versions_included": [
            {"version_label": v["version_label"], "artefact_id": v["artefact_id"]}
            for v in manifest
        ],
    }
    if warnings:
        result["warnings"] = warnings
    return json.dumps(result, indent=2)
