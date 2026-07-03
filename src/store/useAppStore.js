import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  perfil: null,
  modalidadeSelecionada: null,
  origemAulas: null,

  setUser: (user) => set({ user }),
  setPerfil: (perfil) => set({ perfil }),
  setModalidadeSelecionada: (modalidade) => set({ modalidadeSelecionada: modalidade }),
  setOrigemAulas: (origem) => set({ origemAulas: origem }),

  reset: () => set({ user: null, perfil: null, modalidadeSelecionada: null, origemAulas: null }),
}))

export default useAppStore
