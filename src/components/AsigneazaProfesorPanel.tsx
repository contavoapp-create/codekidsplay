'use client'

import { useEffect, useState } from 'react'
import { GraduationCap, Save } from 'lucide-react'
import { listStaffAction, type StaffMember } from '@/app/actions/profesori'
import {
  getProfesoriCursantAction,
  setProfesoriCursantAction,
} from '@/app/actions/cursanti'
import { getCreds } from '@/lib/auth'
import {
  asigneazaCursantProfesor,
  profesoriKeysPentruCursant,
  setProfesoriPentruCursant,
} from '@/lib/profesorAsignari'
import { getStaffSession } from '@/lib/vizibilitateCursanti'
import { isSupabaseConfiguredClient } from '@/lib/supabase/publicFlag'

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  )
}

export default function AsigneazaProfesorPanel({ cursantId }: { cursantId: string }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [profesori, setProfesori] = useState<StaffMember[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const useSupabase = isSupabaseConfiguredClient() && isUuid(cursantId)

  useEffect(() => {
    const s = getStaffSession()
    if (s?.rol !== 'admin') return
    setIsAdmin(true)

    const load = async () => {
      if (useSupabase) {
        const staff = await listStaffAction()
        if (staff.ok) {
          setProfesori(staff.data.filter(p => p.rol === 'profesor'))
        }
        const cur = await getProfesoriCursantAction(cursantId)
        if (cur.ok) setSelected(cur.profesor_ids)
      } else {
        // Cursanți mock (u1…) sau Supabase neconfigurat → asignare locală
        if (isSupabaseConfiguredClient()) {
          const staff = await listStaffAction()
          if (staff.ok) {
            setProfesori(
              staff.data
                .filter(p => p.rol === 'profesor')
                .map(p => ({
                  ...p,
                  // cheie locală: email (mock asignări) dacă există
                  id: p.email || p.id,
                })),
            )
          }
        } else {
          setProfesori(
            getCreds()
              .email.filter(e => e.tip === 'profesor')
              .map(e => ({
                id: e.email,
                email: e.email,
                nume: e.nume,
                rol: 'profesor' as const,
              })),
          )
        }
        setSelected(profesoriKeysPentruCursant(cursantId))
      }
    }
    void load()
  }, [cursantId, useSupabase])

  if (!isAdmin) return null

  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const onSave = async () => {
    setSaving(true)
    setMsg(null)
    if (useSupabase) {
      const r = await setProfesoriCursantAction(cursantId, selected)
      setSaving(false)
      setMsg(r.ok ? 'Asignare salvată.' : r.error)
      return
    }
    setProfesoriPentruCursant(cursantId, selected)
    const creds = getCreds()
    // Asigură și cont mock profesor@… dacă există
    let mockProf = creds.email.find(e => e.tip === 'profesor')
    if (!mockProf && isSupabaseConfiguredClient()) {
      // creează stub local pentru sync sesiune mock (opțional)
      mockProf = {
        tip: 'profesor',
        email: 'profesor@codemakerclub.ro',
        parola: 'profesor123',
        nume: 'Profesor',
        cursant_ids: [],
      }
      creds.email.push(mockProf)
    }
    for (const p of profesori) {
      const key = (p.email || p.id).toLowerCase()
      const cont =
        creds.email.find(
          e => e.tip === 'profesor' && e.email.toLowerCase() === key,
        ) ?? mockProf
      if (selected.includes(p.id) || (p.email && selected.includes(p.email))) {
        asigneazaCursantProfesor(key, cursantId)
        if (cont && !cont.cursant_ids.includes(cursantId)) {
          cont.cursant_ids.push(cursantId)
        }
      } else if (cont) {
        cont.cursant_ids = cont.cursant_ids.filter(id => id !== cursantId)
      }
    }
    localStorage.setItem('ckp-auth-creds-v2', JSON.stringify(creds))
    setSaving(false)
    setMsg('Asignare salvată.')
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap size={18} className="text-violet-600" />
        <h2 className="font-semibold text-slate-900">Profesori asignați</h2>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Profesorii văd doar cursanții pe care îi asignezi aici.
      </p>

      {profesori.length === 0 ? (
        <p className="text-sm text-slate-400">Niciun profesor creat încă.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {profesori.map(p => {
            const id = p.id
            const checked = selected.includes(id) || selected.includes(p.email)
            return (
              <li key={id}>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(id)}
                    className="rounded border-slate-300"
                  />
                  <span className="font-medium text-slate-800 text-sm">{p.nume}</span>
                  {p.email ? (
                    <span className="text-xs text-slate-400 truncate">{p.email}</span>
                  ) : null}
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {msg ? <p className="text-sm text-emerald-700 mb-3">{msg}</p> : null}

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saving || profesori.length === 0}
        className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl"
      >
        <Save size={16} />
        {saving ? 'Salvez…' : 'Salvează asignarea'}
      </button>
    </div>
  )
}
