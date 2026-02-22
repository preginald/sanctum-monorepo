import re
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models import Article

def resolve_content(db: Session, text: str, depth: int = 0, max_depth: int = 2, seen_slugs: set = None) -> str:
    """
    Parses text for {{article:slug}} or {{article:identifier}} shortcodes.
    Replaces them with wrapped HTML containing the embedded article content.
    Prevents infinite loops via recursion limits and a seen_slugs set.
    """
    if not text or depth > max_depth:
        return text

    if seen_slugs is None:
        seen_slugs = set()

    # Match {{article:SOP-099}} or {{article:some-slug}}
    pattern = re.compile(r'\{\{article:([a-zA-Z0-9-]+)\}\}')
    matches = pattern.findall(text)

    if not matches:
        return text

    # Filter out already seen to prevent infinite loops
    to_fetch = list(set([m for m in matches if m not in seen_slugs]))
    
    if not to_fetch:
        return text

    # Bulk fetch dependencies to avoid N+1 queries
    articles = db.query(Article).filter(
        or_(
            Article.slug.in_(to_fetch),
            Article.identifier.in_(to_fetch)
        )
    ).all()

    # Create a lookup dictionary for both slug and identifier
    article_map = {}
    for a in articles:
        if a.slug:
            article_map[a.slug] = a
        if a.identifier:
            article_map[a.identifier] = a

    def replacer(match):
        ref = match.group(1)
        if ref in seen_slugs:
            return f""
        
        article = article_map.get(ref)
        if not article:
            return f""

        # Add to seen list for this branch
        branch_seen = set(seen_slugs)
        branch_seen.add(ref)
        
        # Recursively resolve content of the embedded article
        embedded_content = resolve_content(db, article.content, depth + 1, max_depth, branch_seen)
        
        # Wrap in the Intelligence Dossier semantic HTML
        return (
            f'\n<div class="ds-embed" data-identifier="{article.identifier or article.slug}">\n'
            f'  <div class="ds-embed-header">\n'
            f'    <a href="/wiki/{article.slug}">🔗 {article.title}</a>\n'
            f'  </div>\n'
            f'  <div class="ds-embed-content">\n\n'
            f'{embedded_content}\n\n'
            f'  </div>\n'
            f'</div>\n'
        )

    return pattern.sub(replacer, text)
