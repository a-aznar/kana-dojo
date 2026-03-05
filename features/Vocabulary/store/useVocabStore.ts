import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface IVocabObj {
  word: string;
  reading: string;
  meanings: string[];
}

interface IFormState {
  selectedGameModeVocab: string;
  selectedVocabObjs: IVocabObj[];
  setSelectedGameModeVocab: (mode: string) => void;
  setSelectedVocabObjs: (vocabObjs: IVocabObj[]) => void;
  addVocabObj: (vocabObj: IVocabObj) => void;
  addVocabObjs: (vocabObjs: IVocabObj[]) => void;
  clearVocabObjs: () => void;

  selectedVocabCollection: string;
  setSelectedVocabCollection: (collection: string) => void;

  selectedVocabSets: string[];
  setSelectedVocabSets: (sets: string[]) => void;
  clearVocabSets: () => void;

  // Collapsed rows per unit (keyed by collection name)
  collapsedRowsByUnit: Record<string, number[]>;
  setCollapsedRowsForUnit: (unit: string, rows: number[]) => void;

  customDecks: IVocabDeck[];
  createCustomDeck: (name: string, vocabObjs: IVocabObj[]) => void;
  updateCustomDeckName: (deckId: string, name: string) => void;
  addVocabToCustomDeck: (deckId: string, vocabObj: IVocabObj) => void;
  setCustomDeckVocab: (deckId: string, vocabObjs: IVocabObj[]) => void;
  removeVocabFromCustomDeck: (deckId: string, word: string) => void;
  deleteCustomDeck: (deckId: string) => void;
}

export interface IVocabDeck {
  id: string;
  name: string;
  vocabObjs: IVocabObj[];
}

const DECK_NAME_CHAR_LIMIT = 40;

const uniqByWord = (vocabObjs: IVocabObj[]) => {
  const seenWords = new Set<string>();
  return vocabObjs.filter(vocabObj => {
    if (seenWords.has(vocabObj.word)) return false;
    seenWords.add(vocabObj.word);
    return true;
  });
};

const sanitizeDeckName = (name: string) =>
  name.trim().slice(0, DECK_NAME_CHAR_LIMIT);

const useVocabStore = create<IFormState>()(
  persist(
    set => ({
      selectedGameModeVocab: 'Pick',
      selectedVocabObjs: [],
      setSelectedGameModeVocab: gameMode =>
        set({ selectedGameModeVocab: gameMode }),
      setSelectedVocabObjs: vocabObjs =>
        set({ selectedVocabObjs: uniqByWord(vocabObjs) }),
      addVocabObj: vocabObj =>
        set(state => ({
          selectedVocabObjs: state.selectedVocabObjs
            .map(currentVocabObj => currentVocabObj.word)
            .includes(vocabObj.word)
            ? state.selectedVocabObjs.filter(
                currentVocabObj => currentVocabObj.word !== vocabObj.word,
              )
            : [...state.selectedVocabObjs, vocabObj],
        })),
      addVocabObjs: vocabObjs =>
        set(state => ({
          selectedVocabObjs: vocabObjs.every(currentVocabObj =>
            state.selectedVocabObjs
              .map(selectedVocabObj => selectedVocabObj.word)
              .includes(currentVocabObj.word),
          )
            ? state.selectedVocabObjs.filter(
                currentVocabObj =>
                  !vocabObjs
                    .map(vocabObj => vocabObj.word)
                    .includes(currentVocabObj.word),
              )
            : uniqByWord([...state.selectedVocabObjs, ...vocabObjs]),
        })),
      clearVocabObjs: () => {
        set(() => ({
          selectedVocabObjs: [],
        }));
      },

      selectedVocabCollection: 'n5',
      setSelectedVocabCollection: collection =>
        set({ selectedVocabCollection: collection }),
      selectedVocabSets: [],
      setSelectedVocabSets: sets => set({ selectedVocabSets: sets }),
      clearVocabSets: () => {
        set(() => ({
          selectedVocabSets: [],
        }));
      },

      collapsedRowsByUnit: {},
      setCollapsedRowsForUnit: (unit, rows) =>
        set(state => ({
          collapsedRowsByUnit: {
            ...state.collapsedRowsByUnit,
            [unit]: rows,
          },
        })),

      customDecks: [],
      createCustomDeck: (name, vocabObjs) =>
        set(state => {
          const sanitizedName = sanitizeDeckName(name);
          if (!sanitizedName) return state;

          return {
            customDecks: [
              ...state.customDecks,
              {
                id:
                  typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                name: sanitizedName,
                vocabObjs: uniqByWord(vocabObjs),
              },
            ],
          };
        }),
      updateCustomDeckName: (deckId, name) =>
        set(state => {
          const sanitizedName = sanitizeDeckName(name);
          if (!sanitizedName) return state;

          return {
            customDecks: state.customDecks.map(deck =>
              deck.id === deckId ? { ...deck, name: sanitizedName } : deck,
            ),
          };
        }),
      addVocabToCustomDeck: (deckId, vocabObj) =>
        set(state => ({
          customDecks: state.customDecks.map(deck =>
            deck.id === deckId
              ? {
                  ...deck,
                  vocabObjs: uniqByWord([...deck.vocabObjs, vocabObj]),
                }
              : deck,
          ),
        })),
      setCustomDeckVocab: (deckId, vocabObjs) =>
        set(state => ({
          customDecks: state.customDecks.map(deck =>
            deck.id === deckId
              ? {
                  ...deck,
                  vocabObjs: uniqByWord(vocabObjs),
                }
              : deck,
          ),
        })),
      removeVocabFromCustomDeck: (deckId, word) =>
        set(state => ({
          customDecks: state.customDecks.map(deck =>
            deck.id === deckId
              ? {
                  ...deck,
                  vocabObjs: deck.vocabObjs.filter(
                    vocabObj => vocabObj.word !== word,
                  ),
                }
              : deck,
          ),
        })),
      deleteCustomDeck: deckId =>
        set(state => ({
          customDecks: state.customDecks.filter(deck => deck.id !== deckId),
        })),
    }),
    {
      name: 'vocabulary-storage',
      storage:
        typeof window !== 'undefined'
          ? createJSONStorage(() => localStorage)
          : undefined,
      partialize: state => ({
        customDecks: state.customDecks,
      }),
    },
  ),
);

export default useVocabStore;
