import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmationModal from './ConfirmationModal';
import React from 'react';

describe('ConfirmationModal', () => {
    
    it('does not render when isOpen is false', () => {
        render(<ConfirmationModal isOpen={false} title="Test" />);
        expect(screen.queryByText('Test')).toBeNull();
    });

    it('renders title and message when open', () => {
        render(
            <ConfirmationModal 
                isOpen={true} 
                title="Delete Everything?" 
                message="Are you sure?" 
            />
        );
        expect(screen.getByText('Delete Everything?')).toBeTruthy();
        expect(screen.getByText('Are you sure?')).toBeTruthy();
    });

    it('triggers onClose when Cancel is clicked', () => {
        const handleClose = vi.fn(); // Mock function
        render(
            <ConfirmationModal 
                isOpen={true} 
                onClose={handleClose} 
                onConfirm={() => {}} 
            />
        );
        
        fireEvent.click(screen.getByText('Cancel'));
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('triggers onConfirm AND onClose when Confirm is clicked', () => {
        const handleClose = vi.fn();
        const handleConfirm = vi.fn();
        
        render(
            <ConfirmationModal 
                isOpen={true} 
                onClose={handleClose} 
                onConfirm={handleConfirm} 
                confirmText="Yes, Do it"
            />
        );
        
        fireEvent.click(screen.getByText('Yes, Do it'));
        expect(handleConfirm).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('applies danger styling when isDangerous is true', () => {
        render(
            <ConfirmationModal 
                isOpen={true} 
                isDangerous={true} 
                confirmText="Nuke it"
            />
        );
        
        const btn = screen.getByText('Nuke it');
        // Check for red styling class
        expect(btn.className).toContain('bg-red-600');
    });
});