'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ActionButton } from '@/shared/components/ui/ActionButton';
import { useClick } from '@/shared/hooks/useAudio';
import {
  vocabDataService,
  type VocabLevel,
} from '@/features/Vocabulary/services/vocabDataService';
import useVocabStore, {
  type IVocabObj,
} from '@/features/Vocabulary/store/useVocabStore';
import { Circle, CircleCheck, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { toKana, toRomaji } from 'wanakana';

const ALL_LEVELS: VocabLevel[] = ['n5', 'n4', 'n3', 'n2', 'n1'];
const SEARCH_RESULTS_LIMIT = 80;
const DECK_NAME_CHAR_LIMIT = 40;

const normalize = (text: string) => text.toLowerCase().trim();

interface QueryVariants {
  normalizedQuery: string;
  queryKana: string;
  queryRomaji: string;
}

interface SearchableVocabObj {
  vocabObj: IVocabObj;
  searchTerms: string[];
}

const includesQuery = (
  searchableVocabObj: SearchableVocabObj,
  queryVariants: QueryVariants,
) => {
  if (!queryVariants.normalizedQuery) return true;

  return searchableVocabObj.searchTerms.some(
    term =>
      term.includes(queryVariants.normalizedQuery) ||
      term.includes(queryVariants.queryKana) ||
      term.includes(queryVariants.queryRomaji),
  );
};

const dedupeWords = (vocabObjs: IVocabObj[]) => {
  const seenWords = new Set<string>();
  return vocabObjs.filter(vocabObj => {
    if (seenWords.has(vocabObj.word)) return false;
    seenWords.add(vocabObj.word);
    return true;
  });
};

const CustomDeckManager = () => {
  const { playClick } = useClick();

  const customDecks = useVocabStore(state => state.customDecks);
  const createCustomDeck = useVocabStore(state => state.createCustomDeck);
  const updateCustomDeckName = useVocabStore(
    state => state.updateCustomDeckName,
  );
  const setCustomDeckVocab = useVocabStore(state => state.setCustomDeckVocab);
  const deleteCustomDeck = useVocabStore(state => state.deleteCustomDeck);
  const setSelectedVocabObjs = useVocabStore(
    state => state.setSelectedVocabObjs,
  );
  const setSelectedVocabSets = useVocabStore(
    state => state.setSelectedVocabSets,
  );

  const [allVocabObjs, setAllVocabObjs] = useState<SearchableVocabObj[]>([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [deckNameInput, setDeckNameInput] = useState('');
  const [deckSearch, setDeckSearch] = useState('');
  const [draftSelection, setDraftSelection] = useState<IVocabObj[]>([]);
  const [deckPendingDelete, setDeckPendingDelete] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const loadAllVocab = async () => {
      const allLevels = await Promise.all(
        ALL_LEVELS.map(level => vocabDataService.getVocabByLevel(level)),
      );

      const searchableVocabObjs = dedupeWords(allLevels.flat()).map(
        vocabObj => ({
          vocabObj,
          searchTerms: [
            normalize(vocabObj.word),
            normalize(vocabObj.reading),
            normalize(toKana(vocabObj.word)),
            normalize(toKana(vocabObj.reading)),
            normalize(toRomaji(vocabObj.word)),
            normalize(toRomaji(vocabObj.reading)),
            ...vocabObj.meanings.map(meaning => normalize(meaning)),
          ],
        }),
      );

      setAllVocabObjs(searchableVocabObjs);
    };

    void loadAllVocab();
  }, []);

  useEffect(() => {
    const existingDeckIds = new Set(customDecks.map(deck => deck.id));
    setSelectedDeckIds(prev =>
      prev.filter(selectedDeckId => existingDeckIds.has(selectedDeckId)),
    );
  }, [customDecks]);

  useEffect(() => {
    const selectedDecks = customDecks.filter(deck =>
      selectedDeckIds.includes(deck.id),
    );

    setSelectedVocabObjs(
      dedupeWords(selectedDecks.flatMap(deck => deck.vocabObjs)),
    );
    setSelectedVocabSets(selectedDecks.map(deck => `Deck: ${deck.name}`));
  }, [
    customDecks,
    selectedDeckIds,
    setSelectedVocabObjs,
    setSelectedVocabSets,
  ]);

  const selectedDraftWords = useMemo(
    () => new Set(draftSelection.map(vocabObj => vocabObj.word)),
    [draftSelection],
  );

  const filteredResults = useMemo(
    () => {
      const queryVariants = {
        normalizedQuery: normalize(deckSearch),
        queryKana: normalize(toKana(deckSearch)),
        queryRomaji: normalize(toRomaji(deckSearch)),
      };

      return allVocabObjs
        .filter(vocabObj => includesQuery(vocabObj, queryVariants))
        .map(({ vocabObj }) => vocabObj)
        .slice(0, SEARCH_RESULTS_LIMIT);
    },
    [allVocabObjs, deckSearch],
  );

  const openCreateEditor = () => {
    playClick();
    setEditingDeckId(null);
    setDeckNameInput('');
    setDeckSearch('');
    setDraftSelection([]);
    setIsEditorOpen(true);
  };

  const openEditEditor = (deckId: string) => {
    const deck = customDecks.find(currentDeck => currentDeck.id === deckId);
    if (!deck) return;

    playClick();
    setEditingDeckId(deck.id);
    setDeckNameInput(deck.name);
    setDeckSearch('');
    setDraftSelection(deck.vocabObjs);
    setIsEditorOpen(true);
  };

  const toggleDraftVocab = (vocabObj: IVocabObj) => {
    setDraftSelection(prev =>
      prev.some(currentVocab => currentVocab.word === vocabObj.word)
        ? prev.filter(currentVocab => currentVocab.word !== vocabObj.word)
        : dedupeWords([...prev, vocabObj]),
    );
  };

  const saveDeck = () => {
    const trimmedName = deckNameInput.trim();
    if (!trimmedName || draftSelection.length === 0) return;

    playClick();
    if (!editingDeckId) {
      createCustomDeck(trimmedName, draftSelection);
    } else {
      updateCustomDeckName(editingDeckId, trimmedName);
      setCustomDeckVocab(editingDeckId, draftSelection);
    }

    setIsEditorOpen(false);
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className='mx-4 flex items-center justify-between rounded-3xl border-2 border-(--border-color) bg-(--card-color) p-4'>
        <div>
          <h2 className='text-2xl'>Custom Vocabulary Decks</h2>
          <p className='text-sm text-(--secondary-color)'>
            Create and edit decks in a popup, then select decks to practice.
          </p>
        </div>
        <ActionButton
          onClick={openCreateEditor}
          borderRadius='3xl'
          borderBottomThickness={10}
          colorScheme='main'
          borderColorScheme='main'
          className='px-4 py-3'
        >
          <Plus size={16} />
          New Deck
        </ActionButton>
      </div>

      <div className='mx-4 flex flex-col gap-3'>
        {customDecks.map(deck => {
          const isSelected = selectedDeckIds.includes(deck.id);

          return (
            <div
              key={deck.id}
              className='flex flex-col gap-3 rounded-3xl border-2 border-(--border-color) bg-(--card-color) p-4'
            >
              <button
                onClick={() => {
                  playClick();
                  setSelectedDeckIds(prev =>
                    prev.includes(deck.id)
                      ? prev.filter(currentDeckId => currentDeckId !== deck.id)
                      : [...prev, deck.id],
                  );
                }}
                className={clsx(
                  'group flex items-center justify-center gap-2 rounded-3xl border-b-10 px-2 py-3 text-2xl transition-all duration-250 ease-in-out',
                  isSelected
                    ? 'border-(--secondary-color-accent) bg-(--secondary-color) text-(--background-color)'
                    : 'border-(--border-color) bg-(--background-color) hover:border-(--main-color)/70',
                )}
              >
                {isSelected ? (
                  <CircleCheck className='mt-0.5 fill-current text-(--background-color) duration-250' />
                ) : (
                  <Circle className='mt-0.5 text-(--border-color) duration-250' />
                )}
                {deck.name}
              </button>

              <div className='flex items-center justify-between'>
                <p className='text-sm text-(--secondary-color)'>
                  {deck.vocabObjs.length} vocab in deck
                </p>
                <div className='flex gap-2'>
                  <ActionButton
                    onClick={() => openEditEditor(deck.id)}
                    borderRadius='3xl'
                    borderBottomThickness={8}
                    colorScheme='main'
                    borderColorScheme='main'
                    className='px-3 py-2'
                  >
                    <Pencil size={14} />
                    Edit
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      playClick();
                      setDeckPendingDelete(deck.id);
                    }}
                    borderRadius='3xl'
                    borderBottomThickness={8}
                    colorScheme='secondary'
                    borderColorScheme='secondary'
                    className='px-3 py-2'
                  >
                    <Trash2 size={14} />
                    Delete
                  </ActionButton>
                </div>
              </div>
            </div>
          );
        })}

        {customDecks.length === 0 && (
          <p className='rounded-2xl border-2 border-(--border-color) bg-(--card-color) px-4 py-3 text-(--secondary-color)'>
            No custom decks yet. Create one above.
          </p>
        )}
      </div>

      <AlertDialog
        open={deckPendingDelete !== null}
        onOpenChange={open => {
          if (!open) setDeckPendingDelete(null);
        }}
      >
        <AlertDialogContent className='rounded-3xl border-(--border-color) bg-(--card-color)'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-2xl font-bold text-(--main-color)'>
              Delete Deck?
            </AlertDialogTitle>
            <AlertDialogDescription className='text-base text-(--secondary-color)'>
              This will permanently delete this custom deck. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='gap-3'>
            <AlertDialogCancel
              onClick={() => {
                playClick();
                setDeckPendingDelete(null);
              }}
              className='cursor-pointer rounded-full border-(--border-color) px-6 text-(--main-color) transition-colors duration-300 hover:bg-(--background-color)'
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deckPendingDelete) return;
                playClick();
                deleteCustomDeck(deckPendingDelete);
                setDeckPendingDelete(null);
              }}
              className='cursor-pointer rounded-full bg-(--secondary-color) px-6 transition-colors duration-300 hover:bg-(--secondary-color)/80'
            >
              Delete Deck
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isEditorOpen && (
        <div className='fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4'>
          <div className='flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-(--border-color) bg-(--background-color)'>
            <div className='flex items-center justify-between border-b border-(--border-color) p-4'>
              <div>
                <h3 className='text-2xl'>
                  {editingDeckId ? 'Edit Custom Deck' : 'Create Custom Deck'}
                </h3>
                <p className='text-sm text-(--secondary-color)'>
                  Name is required, up to {DECK_NAME_CHAR_LIMIT} characters, and
                  at least 1 vocabulary item.
                </p>
              </div>
              <button
                onClick={() => {
                  playClick();
                  setIsEditorOpen(false);
                }}
                className='rounded-xl p-2 hover:bg-(--card-color)'
              >
                <X />
              </button>
            </div>

            <div className='flex shrink-0 flex-col gap-3 border-b border-(--border-color) p-4'>
              <input
                type='text'
                maxLength={DECK_NAME_CHAR_LIMIT}
                value={deckNameInput}
                onChange={event => setDeckNameInput(event.target.value)}
                placeholder='Deck name'
                className='rounded-2xl border-2 border-(--border-color) bg-(--background-color) px-3 py-2 text-(--main-color) outline-none'
              />
              <input
                type='text'
                value={deckSearch}
                onChange={event => setDeckSearch(event.target.value)}
                placeholder='Search by kanji, kana, hiragana, romaji, or meaning...'
                className='rounded-2xl border-2 border-(--border-color) bg-(--background-color) px-3 py-2 text-(--main-color) outline-none'
              />
            </div>

            <div className='grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <h4 className='text-lg'>Selected ({draftSelection.length})</h4>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                  {draftSelection.map(vocabObj => (
                    <button
                      key={`selected-${vocabObj.word}`}
                      onClick={() => {
                        playClick();
                        toggleDraftVocab(vocabObj);
                      }}
                      className='rounded-2xl border-2 border-(--secondary-color) bg-(--card-color) p-3 text-left'
                    >
                      <p className='text-2xl'>{vocabObj.word}</p>
                      <p className='text-sm text-(--secondary-color)'>
                        {toRomaji(toKana(vocabObj.reading))}
                      </p>
                      <p className='text-sm text-(--secondary-color)'>
                        {vocabObj.meanings[0]}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className='flex flex-col gap-2'>
                <h4 className='text-lg'>Search Results</h4>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                  {filteredResults.map(vocabObj => {
                    const isSelected = selectedDraftWords.has(vocabObj.word);
                    return (
                      <button
                        key={`result-${vocabObj.word}`}
                        onClick={() => {
                          playClick();
                          toggleDraftVocab(vocabObj);
                        }}
                        className={clsx(
                          'rounded-2xl border-2 p-3 text-left',
                          isSelected
                            ? 'border-(--secondary-color) bg-(--card-color)'
                            : 'border-(--border-color) bg-(--background-color)',
                        )}
                      >
                        <p className='text-2xl'>{vocabObj.word}</p>
                        <p className='text-sm text-(--secondary-color)'>
                          {toRomaji(toKana(vocabObj.reading))}
                        </p>
                        <p className='text-sm text-(--secondary-color)'>
                          {vocabObj.meanings[0]}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className='flex justify-end border-t border-(--border-color) p-4'>
              <ActionButton
                onClick={saveDeck}
                borderRadius='3xl'
                borderBottomThickness={10}
                colorScheme='main'
                borderColorScheme='main'
                className='px-5 py-3'
              >
                Save Deck
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDeckManager;
