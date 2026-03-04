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

const ALL_LEVELS: VocabLevel[] = ['n5', 'n4', 'n3', 'n2', 'n1'];
const SEARCH_RESULTS_LIMIT = 25;

const normalize = (text: string) => text.toLowerCase().trim();

const includesQuery = (vocabObj: IVocabObj, query: string) => {
  if (!query) return true;
  const normalizedQuery = normalize(query);
  return (
    normalize(vocabObj.word).includes(normalizedQuery) ||
    normalize(vocabObj.reading).includes(normalizedQuery) ||
    vocabObj.meanings.some(meaning =>
      normalize(meaning).includes(normalizedQuery),
    )
  );
};

const CustomDeckManager = () => {
  const { playClick } = useClick();

  const customDecks = useVocabStore(state => state.customDecks);
  const createCustomDeck = useVocabStore(state => state.createCustomDeck);
  const updateCustomDeckName = useVocabStore(
    state => state.updateCustomDeckName,
  );
  const addVocabToCustomDeck = useVocabStore(
    state => state.addVocabToCustomDeck,
  );
  const removeVocabFromCustomDeck = useVocabStore(
    state => state.removeVocabFromCustomDeck,
  );
  const deleteCustomDeck = useVocabStore(state => state.deleteCustomDeck);
  const setSelectedVocabObjs = useVocabStore(
    state => state.setSelectedVocabObjs,
  );
  const setSelectedVocabSets = useVocabStore(
    state => state.setSelectedVocabSets,
  );

  const [allVocabObjs, setAllVocabObjs] = useState<IVocabObj[]>([]);
  const [deckNameInput, setDeckNameInput] = useState('');
  const [createSearch, setCreateSearch] = useState('');
  const [createSelection, setCreateSelection] = useState<IVocabObj[]>([]);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);

  useEffect(() => {
    const loadAllVocab = async () => {
      const allLevels = await Promise.all(
        ALL_LEVELS.map(level => vocabDataService.getVocabByLevel(level)),
      );

      const allWords = allLevels.flat();
      const dedupedWords = allWords.filter(
        (wordObj, index, array) =>
          array.findIndex(
            currentWordObj => currentWordObj.word === wordObj.word,
          ) === index,
      );

      setAllVocabObjs(dedupedWords);
    };

    void loadAllVocab();
  }, []);

  const createSelectionWords = useMemo(
    () => new Set(createSelection.map(vocabObj => vocabObj.word)),
    [createSelection],
  );

  const createSearchResults = useMemo(
    () =>
      allVocabObjs
        .filter(vocabObj => includesQuery(vocabObj, createSearch))
        .slice(0, SEARCH_RESULTS_LIMIT),
    [allVocabObjs, createSearch],
  );

  const editingDeck = useMemo(
    () => customDecks.find(deck => deck.id === editingDeckId) ?? null,
    [customDecks, editingDeckId],
  );

  const [editSearch, setEditSearch] = useState('');

  const editSearchResults = useMemo(() => {
    if (!editingDeck) return [];
    const selectedWords = new Set(
      editingDeck.vocabObjs.map(vocabObj => vocabObj.word),
    );

    return allVocabObjs
      .filter(vocabObj => !selectedWords.has(vocabObj.word))
      .filter(vocabObj => includesQuery(vocabObj, editSearch))
      .slice(0, SEARCH_RESULTS_LIMIT);
  }, [allVocabObjs, editSearch, editingDeck]);

  return (
    <div className='flex flex-col gap-4'>
      <div className='mx-4 flex flex-col gap-3 rounded-3xl border-2 border-(--border-color) bg-(--card-color) p-4'>
        <h2 className='text-2xl'>Custom Vocabulary Decks</h2>
        <input
          type='text'
          value={deckNameInput}
          onChange={event => setDeckNameInput(event.target.value)}
          placeholder='Deck name (e.g. Travel words)'
          className='rounded-2xl border-2 border-(--border-color) bg-(--background-color) px-3 py-2 text-(--main-color) outline-none'
        />
        <input
          type='text'
          value={createSearch}
          onChange={event => setCreateSearch(event.target.value)}
          placeholder='Search vocab to add...'
          className='rounded-2xl border-2 border-(--border-color) bg-(--background-color) px-3 py-2 text-(--main-color) outline-none'
        />

        <div className='max-h-52 overflow-y-auto rounded-2xl border-2 border-(--border-color) bg-(--background-color) p-2'>
          {createSearchResults.length === 0 ? (
            <p className='px-2 py-1 text-sm text-(--secondary-color)'>
              No matches found.
            </p>
          ) : (
            createSearchResults.map(vocabObj => {
              const isAdded = createSelectionWords.has(vocabObj.word);
              return (
                <button
                  key={vocabObj.word}
                  onClick={() => {
                    playClick();
                    setCreateSelection(prev =>
                      isAdded
                        ? prev.filter(
                            currentVocabObj =>
                              currentVocabObj.word !== vocabObj.word,
                          )
                        : [...prev, vocabObj],
                    );
                  }}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left',
                    isAdded
                      ? 'bg-(--secondary-color)/30'
                      : 'hover:bg-(--card-color)',
                  )}
                >
                  <span>
                    {vocabObj.word}{' '}
                    <span className='text-sm text-(--secondary-color)'>
                      ({vocabObj.reading})
                    </span>
                  </span>
                  <span className='text-xs text-(--secondary-color)'>
                    {isAdded ? 'Added' : 'Add'}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <p className='text-sm text-(--secondary-color)'>
          Selected for new deck: {createSelection.length}
        </p>

        <ActionButton
          onClick={() => {
            const trimmedDeckName = deckNameInput.trim();
            if (!trimmedDeckName || createSelection.length === 0) return;
            playClick();
            createCustomDeck(trimmedDeckName, createSelection);
            setDeckNameInput('');
            setCreateSearch('');
            setCreateSelection([]);
          }}
          borderRadius='3xl'
          borderBottomThickness={10}
          colorScheme='main'
          borderColorScheme='main'
          className='px-4 py-2'
        >
          Create Deck
        </ActionButton>
      </div>

      <div className='mx-4 flex flex-col gap-3'>
        {customDecks.map(deck => (
          <div
            key={deck.id}
            className='flex flex-col gap-3 rounded-3xl border-2 border-(--border-color) bg-(--card-color) p-4'
          >
            <div className='flex flex-col gap-2 md:flex-row md:items-center'>
              <input
                type='text'
                value={deck.name}
                onChange={event =>
                  updateCustomDeckName(deck.id, event.target.value)
                }
                className='w-full rounded-2xl border-2 border-(--border-color) bg-(--background-color) px-3 py-2 text-xl outline-none'
              />
              <div className='flex items-center gap-2'>
                <ActionButton
                  onClick={() => {
                    playClick();
                    setSelectedVocabObjs(deck.vocabObjs);
                    setSelectedVocabSets([]);
                  }}
                  borderRadius='3xl'
                  borderBottomThickness={8}
                  colorScheme='secondary'
                  borderColorScheme='secondary'
                  className='px-3 py-2'
                >
                  Play Deck
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    playClick();
                    setEditingDeckId(currentDeckId =>
                      currentDeckId === deck.id ? null : deck.id,
                    );
                    setEditSearch('');
                  }}
                  borderRadius='3xl'
                  borderBottomThickness={8}
                  colorScheme='secondary'
                  borderColorScheme='secondary'
                  className='px-3 py-2'
                >
                  {editingDeckId === deck.id ? 'Close Edit' : 'Edit'}
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    playClick();
                    deleteCustomDeck(deck.id);
                    if (editingDeckId === deck.id) setEditingDeckId(null);
                  }}
                  borderRadius='3xl'
                  borderBottomThickness={8}
                  colorScheme='secondary'
                  borderColorScheme='secondary'
                  className='px-3 py-2'
                >
                  Delete
                </ActionButton>
              </div>
            </div>

            <p className='text-sm text-(--secondary-color)'>
              {deck.vocabObjs.length} vocab in deck
            </p>

            {editingDeckId === deck.id && (
              <div className='flex flex-col gap-2 rounded-2xl border-2 border-(--border-color) bg-(--background-color) p-3'>
                <input
                  type='text'
                  value={editSearch}
                  onChange={event => setEditSearch(event.target.value)}
                  placeholder='Search vocab to add to this deck...'
                  className='rounded-xl border-2 border-(--border-color) bg-(--background-color) px-3 py-2 outline-none'
                />

                <div className='max-h-44 overflow-y-auto'>
                  {editSearchResults.map(vocabObj => (
                    <button
                      key={`${deck.id}-${vocabObj.word}`}
                      onClick={() => {
                        playClick();
                        addVocabToCustomDeck(deck.id, vocabObj);
                      }}
                      className='flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-(--card-color)'
                    >
                      <span>{vocabObj.word}</span>
                      <span className='text-xs text-(--secondary-color)'>
                        Add
                      </span>
                    </button>
                  ))}
                </div>

                <div className='max-h-52 overflow-y-auto rounded-xl border-2 border-(--border-color) p-2'>
                  {deck.vocabObjs.map(vocabObj => (
                    <div
                      key={`${deck.id}-selected-${vocabObj.word}`}
                      className='flex items-center justify-between rounded-lg px-2 py-1 hover:bg-(--card-color)'
                    >
                      <span>
                        {vocabObj.word}{' '}
                        <span className='text-sm text-(--secondary-color)'>
                          {vocabObj.meanings[0]}
                        </span>
                      </span>
                      <button
                        onClick={() => {
                          playClick();
                          removeVocabFromCustomDeck(deck.id, vocabObj.word);
                        }}
                        className='text-sm text-(--secondary-color) hover:text-(--main-color)'
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {customDecks.length === 0 && (
          <p className='rounded-2xl border-2 border-(--border-color) bg-(--card-color) px-4 py-3 text-(--secondary-color)'>
            No custom decks yet. Create one above.
          </p>
        )}
      </div>
    </div>
  );
};

export default CustomDeckManager;
