import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadAll, insertRow, updateRow, deleteRow } from './lib/db'

const Ctx = createContext(null)
const EMPTY = { properties: [], bookings: [], payments: [], expenses: [] }

export function DataProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const reload = useCallback(async () => {
    try {
      setData(await loadAll())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind, at: Date.now() })
    setTimeout(() => setToast((t) => (t && Date.now() - t.at >= 2400 ? null : t)), 2500)
  }, [])

  const save = useCallback(async (table, row) => {
    const { id, ...rest } = row
    const saved = id ? await updateRow(table, id, rest) : await insertRow(table, rest)
    await reload()
    return saved
  }, [reload])

  const remove = useCallback(async (table, id) => {
    await deleteRow(table, id)
    await reload()
  }, [reload])

  const value = useMemo(() => {
    const activeProperties = data.properties.filter((p) => !p.archived)
    const propertyById = new Map(data.properties.map((p) => [p.id, p]))
    return { data, loading, error, reload, save, remove, notify, toast, activeProperties, propertyById }
  }, [data, loading, error, reload, save, remove, notify, toast])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)
