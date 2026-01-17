import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from './formatters';

describe('formatters', () => {
    
    describe('formatCurrency', () => {
        it('formats valid numbers to AUD', () => {
            // Note: Output depends on locale, but usually $1,234.56 or A$1,234.56
            // We check for the presence of digits and decimal
            const result = formatCurrency(1234.56);
            expect(result).toContain('1,234.56');
        });

        it('handles zero correctly', () => {
            const result = formatCurrency(0);
            expect(result).toContain('0.00');
        });

        it('handles null/undefined by returning $0.00', () => {
            expect(formatCurrency(null)).toContain('0.00');
            expect(formatCurrency(undefined)).toContain('0.00');
        });
        
        it('handles string inputs gracefully', () => {
            expect(formatCurrency("50.00")).toContain('50.00');
        });
    });

    describe('formatDate', () => {
        it('formats ISO date string', () => {
            const result = formatDate('2026-01-15T10:00:00');
            // Locale string varies, but should contain parts
            expect(result).not.toBe('N/A');
        });

        it('returns N/A for null', () => {
            expect(formatDate(null)).toBe('N/A');
        });
    });
});