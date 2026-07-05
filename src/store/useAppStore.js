import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  perfil: null,
  modalidadeSelecionada: null,
  origemAulas: null,
  empresaSelecionada: null, // { id, nome, logoUrl, role } — empresa (tenant) ativa na sessão

  setUser: (user) => set({ user }),
  setPerfil: (perfil) => set({ perfil }),
  setModalidadeSelecionada: (modalidade) => set({ modalidadeSelecionada: modalidade }),
  setOrigemAulas: (origem) => set({ origemAulas: origem }),
  setEmpresaSelecionada: (empresa) => set({ empresaSelecionada: empresa }),

  reset: () => set({ user: null, perfil: null, modalidadeSelecionada: null, origemAulas: null, empresaSelecionada: null }),
}))

export default useAppStore
