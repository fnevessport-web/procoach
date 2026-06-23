import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  perfil: null,
  modalidadeSelecionada: null,

  setUser: (user) => set({ user }),
  setPerfil: (perfil) => set({ perfil }),
  setModalidadeSelecionada: (modalidade) => set({ modalidadeSelecionada: modalidade }),

  reset: () => set({ user: null, perfil: null, modalidadeSelecionada: null }),
}))

export default useAppStore
