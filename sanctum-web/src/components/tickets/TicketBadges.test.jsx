import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, PriorityBadge } from './TicketBadges';
import React from 'react';

describe('TicketBadges', () => {

    describe('StatusBadge', () => {
        it('renders correct text', () => {
            render(<StatusBadge status="open" />);
            expect(screen.getByText('open')).toBeTruthy();
        });

        it('applies green color for open status', () => {
            const { container } = render(<StatusBadge status="open" />);
            // container.firstChild is the <span>
            expect(container.firstChild.className).toContain('bg-green-500');
        });

        it('applies yellow color for pending status', () => {
            const { container } = render(<StatusBadge status="pending" />);
            expect(container.firstChild.className).toContain('bg-yellow-500');
        });
        
        it('defaults to slate for unknown status', () => {
             const { container } = render(<StatusBadge status="unknown-status" />);
             expect(container.firstChild.className).toContain('bg-slate-500');
        });
    });

    describe('PriorityBadge', () => {
        it('renders critical with pulse animation', () => {
            const { container } = render(<PriorityBadge priority="critical" />);
            expect(container.firstChild.className).toContain('text-red-400');
            expect(container.firstChild.className).toContain('animate-pulse');
        });

        it('renders normal with blue color', () => {
            const { container } = render(<PriorityBadge priority="normal" />);
            expect(container.firstChild.className).toContain('text-blue-400');
        });
    });

});