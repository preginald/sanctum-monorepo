import React from 'react';
import useModalStore from '../store/modalStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext'; // <--- NEW

// IMPORT MODALS
import TicketCreateModal from './tickets/TicketCreateModal';

export default function GlobalModalManager() {
  const { activeModal, modalProps, closeModal } = useModalStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast(); // <--- NEW

  if (!activeModal) return null;

  // HANDLERS
  const handleTicketSuccess = (newTicket) => {
      // 1. GLOBAL FEEDBACK (Fixes Bug #1)
      addToast(`Ticket #${newTicket.id} Created Successfully`, "success");

      // 2. CONTEXT REFRESH (Fixes Bug #2)
      // If the caller (e.g. Tickets.jsx) passed a refresh function, call it.
      if (modalProps.onSuccess) {
          modalProps.onSuccess(newTicket);
      }

      // 3. NAVIGATION & CLEANUP
      closeModal();
      
      // If we were in a deep link, clear URL to prevent loop
      if (location.pathname === '/tickets/new') {
          navigate('/tickets', { replace: true });
      }
  };

  const handleClose = () => {
      closeModal();
      if (location.pathname === '/tickets/new') {
          navigate('/tickets', { replace: true });
      }
  };

  return (
    <>
      {activeModal === 'TICKET_CREATE' && (
        <TicketCreateModal 
            isOpen={true} 
            onClose={handleClose} 
            onSuccess={handleTicketSuccess}
            {...modalProps} 
        />
      )}
    </>
  );
}