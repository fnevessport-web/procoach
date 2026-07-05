import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  perfil: null,
  modalidadeSelecionada: null,
  origemAulas: null,
  empresaSelecionada: null, // { id, nome, logoUrl, role } — empresa (tenant) ativa na sessão
  sessaoRecuperacao: false, // true quando a sessão veio de um link de "esqueci/resetar senha" — força troca mesmo se primeiro_acesso já for false

  setUser: (user) => set({ user }),
  setPerfil: (perfil) => set({ perfil }),
  setModalidadeSelecionada: (modalidade) => set({ modalidadeSelecionada: modalidade }),
  setOrigemAulas: (origem) => set({ origemAulas: origem }),
  setEmpresaSelecionada: (empresa) => set({ empresaSelecionada: empresa }),
  setSessaoRecuperacao: (v) => set({ sessaoRecuperacao: v }),

  reset: () => set({ user: null, perfil: null, modalidadeSelecionada: null, origemAulas: null, empresaSelecionada: null, sessaoRecuperacao: false }),
}))

export default useAppStore
