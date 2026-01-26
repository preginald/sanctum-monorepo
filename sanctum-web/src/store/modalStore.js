import { create } from 'zustand';

const useModalStore = create((set) => ({
  activeModal: null, // 'TICKET_CREATE', 'WIKI_CREATE', etc.
  modalProps: {},    // Pass data into the modal (e.g., initialSubject)
  
  openModal: (modalId, props = {}) => set({ activeModal: modalId, modalProps: props }),
  closeModal: () => set({ activeModal: null, modalProps: {} }),
}));

export default useModalStore;
