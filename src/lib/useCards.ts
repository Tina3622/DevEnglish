import { useState, useEffect, useCallback } from 'react'
import { db, type IFlashcard, makeFlashcard } from '../engine/db'

export interface CardItem {
  id?: number
  word: string
  ipa?: string
  partOfSpeech?: string
  definition: string
  example?: string
  exampleZh?: string
  type?: 'word' | 'sentence'
}

function toCardItem(f: IFlashcard): CardItem {
  return {
    id: f.id, word: f.word, ipa: f.ipa,
    partOfSpeech: f.partOfSpeech, definition: f.definition,
    example: f.example, exampleZh: f.exampleZh,
  }
}

export function useCards() {
  const [cards, setCards] = useState<CardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ word: string; type: 'add' | 'delete' } | null>(null)

  const load = useCallback(async () => {
    const all = await db.flashcards.orderBy('createdAt').reverse().toArray()
    setCards(all.map(toCardItem))
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = useCallback((word: string, type: 'add' | 'delete') => {
    setToast({ word, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const addCard = useCallback(async (data: {
    word: string; ipa?: string; partOfSpeech?: string; definition: string;
    example?: string; exampleZh?: string; type?: 'word' | 'sentence'
  }) => {
    const card = makeFlashcard(data)
    const id = await db.flashcards.add(card)
    setCards(prev => [{ ...data, id } as CardItem, ...prev])
    showToast(data.word, 'add')
    return id
  }, [showToast])

  const deleteCard = useCallback(async (id: number | undefined, word: string) => {
    if (id) await db.flashcards.delete(id)
    setCards(prev => prev.filter(c => c.id !== id))
    showToast(word, 'delete')
  }, [showToast])

  return {
    cards, loading, setLoading,
    toast, clearToast: () => setToast(null),
    addCard, deleteCard, reload: load,
  }
}
