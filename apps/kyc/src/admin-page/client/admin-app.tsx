import React, { useCallback, useEffect, useState } from 'react';

interface DniScanData {
  tramiteNumber: string;
  lastName: string;
  firstName: string;
  gender: string;
  dniNumber: string;
  exemplar: string;
  birthDate: string;
  issueDate: string;
}

interface VerificationItem {
  id: string;
  userId: string;
  status: 'pending' | 'verified' | 'rejected';
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
  notes: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
  dniScanData: DniScanData | null;
  dniScanMatch: boolean | null;
  dniScanErrors: string | null;
  faceMatchConfidence: string | null;
  faceMatch: boolean | null;
  faceMatchError: string | null;
  autoCheckCompletedAt: string | null;
  user?: {
    id: string;
    username: string;
    personal_datum?: {
      firstName: string | null;
      lastName: string | null;
      documentType: string | null;
      documentValue: string | null;
    };
  };
}

interface Props {
  api: string;
  authToken: string;
  locale: string;
  onEvent: (name: string, detail: Record<string, unknown>) => void;
}

type StatusFilter = 'pending' | 'verified' | 'rejected';

const statusColors: Record<string, string> = {
  pending: '#eab308',
  verified: '#22c55e',
  rejected: '#ef4444',
};

export function AdminApp({ api, authToken, locale, onEvent }: Props) {
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VerificationItem | null>(null);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${authToken}`;
  } else {
    headers['x-api-key'] = authToken;
  }

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        status: statusFilter,
        '$sort[createdAt]': '-1',
        '$limit': '50',
      });
      const res = await fetch(`${api}/identity-verifications?${query}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch verifications');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data || [];
      setVerifications(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading verifications');
    } finally {
      setLoading(false);
    }
  }, [api, authToken, statusFilter]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const handleAction = useCallback(async (intent: 'approve' | 'reject') => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        status: intent === 'approve' ? 'verified' : 'rejected',
        notes: notes || null,
      };
      if (intent === 'reject') {
        body.rejectionReason = rejectionReason;
      }
      const res = await fetch(`${api}/identity-verifications/${selected.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Action failed');
      onEvent('kyc-admin:verification-updated', {
        id: selected.id,
        status: body.status as string,
      });
      setSelected(null);
      fetchVerifications();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }, [selected, notes, rejectionReason, api, authToken, onEvent, fetchVerifications]);

  const handleView = useCallback((v: VerificationItem) => {
    setSelected(v);
    setNotes(v.notes || '');
    setRejectionReason('');
  }, []);

  const userName = (v: VerificationItem) => {
    const pd = v.user?.personal_datum;
    if (pd?.firstName || pd?.lastName) {
      return [pd.firstName, pd.lastName].filter(Boolean).join(' ');
    }
    return v.user?.username || v.userId;
  };

  const userDoc = (v: VerificationItem) => {
    const pd = v.user?.personal_datum;
    if (pd?.documentType && pd?.documentValue) {
      return `${pd.documentType} ${pd.documentValue}`;
    }
    return '-';
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '1rem' }}>
      {/* Header + filters */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Verificaciones</h2>
        <div className="flex gap-2">
          {(['pending', 'verified', 'rejected'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border-none cursor-pointer"
              style={{
                backgroundColor: statusFilter === s ? statusColors[s] : '#f3f4f6',
                color: statusFilter === s ? '#fff' : '#4b5563',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {loading && (
        <div className="text-center py-8 text-gray-400">Cargando...</div>
      )}

      {!loading && verifications.length === 0 && (
        <div className="text-center py-8 text-gray-400">No hay verificaciones</div>
      )}

      {/* Table */}
      {!loading && verifications.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 px-3 font-medium">Usuario</th>
              <th className="py-2 px-3 font-medium">Documento</th>
              <th className="py-2 px-3 font-medium">Estado</th>
              <th className="py-2 px-3 font-medium">Checks</th>
              <th className="py-2 px-3 font-medium">Fecha</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {verifications.map(v => (
              <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3">{userName(v)}</td>
                <td className="py-2 px-3">{userDoc(v)}</td>
                <td className="py-2 px-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: statusColors[v.status] + '20', color: statusColors[v.status] }}
                  >
                    {v.status}
                  </span>
                </td>
                <td className="py-2 px-3">
                  {!v.autoCheckCompletedAt && (
                    <span className="text-gray-400 text-xs">Procesando...</span>
                  )}
                  {v.autoCheckCompletedAt && (
                    <div className="flex gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v.dniScanMatch ? 'bg-green-100 text-green-700' : v.dniScanMatch === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                        DNI
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v.faceMatch ? 'bg-green-100 text-green-700' : v.faceMatch === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                        Face
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-2 px-3 text-gray-500">{new Date(v.createdAt).toLocaleDateString()}</td>
                <td className="py-2 px-3">
                  <button
                    className="text-primary-500 text-sm cursor-pointer bg-transparent border-none underline"
                    onClick={() => handleView(v)}
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Detail modal (overlay) */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="font-semibold">{userName(selected)}</div>
                <div className="text-sm text-gray-500">{userDoc(selected)}</div>
              </div>
              <span
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: statusColors[selected.status] + '20', color: statusColors[selected.status] }}
              >
                {selected.status}
              </span>
            </div>

            {/* Photos */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Frente DNI</div>
                <img src={selected.idFrontUrl} alt="ID Front" className="w-full rounded-lg border border-gray-200" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Dorso DNI</div>
                <img src={selected.idBackUrl} alt="ID Back" className="w-full rounded-lg border border-gray-200" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Selfie</div>
                <img src={selected.selfieUrl} alt="Selfie" className="w-full rounded-lg border border-gray-200" />
              </div>
            </div>

            {/* Auto-checks */}
            {selected.autoCheckCompletedAt && (
              <div className="mb-4 space-y-2">
                <div className="font-medium text-sm">Verificaciones automáticas</div>

                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="font-medium mb-1">
                    Escaneo DNI {selected.dniScanMatch === true ? '✓' : selected.dniScanMatch === false ? '✗' : '—'}
                  </div>
                  {selected.dniScanData && (
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div>DNI: {selected.dniScanData.dniNumber}</div>
                      <div>Nombre: {selected.dniScanData.lastName}, {selected.dniScanData.firstName}</div>
                      <div>Nacimiento: {selected.dniScanData.birthDate}</div>
                    </div>
                  )}
                  {selected.dniScanErrors && (
                    <div className="text-xs text-red-500 mt-1">{selected.dniScanErrors}</div>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="font-medium mb-1">
                    Comparación facial {selected.faceMatch === true ? '✓' : selected.faceMatch === false ? '✗' : '—'}
                  </div>
                  {selected.faceMatchConfidence && (
                    <div className="text-xs text-gray-600">Similitud: {selected.faceMatchConfidence}</div>
                  )}
                  {selected.faceMatchError && (
                    <div className="text-xs text-red-500 mt-1">{selected.faceMatchError}</div>
                  )}
                </div>
              </div>
            )}

            {!selected.autoCheckCompletedAt && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
                Verificaciones automáticas en proceso...
              </div>
            )}

            {/* Actions for pending verifications */}
            {selected.status === 'pending' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-y"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notas opcionales..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de rechazo</label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm resize-y"
                    rows={2}
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="Requerido para rechazar..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-500 border-none cursor-pointer disabled:opacity-50"
                    disabled={submitting}
                    onClick={() => handleAction('approve')}
                  >
                    Aprobar
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-white border border-red-300 cursor-pointer disabled:opacity-50"
                    disabled={submitting || !rejectionReason.trim()}
                    onClick={() => handleAction('reject')}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            )}

            {/* Existing notes/rejection */}
            {selected.notes && selected.status !== 'pending' && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="font-medium mb-1">Notas</div>
                <div>{selected.notes}</div>
              </div>
            )}
            {selected.rejectionReason && (
              <div className="p-3 bg-red-50 rounded-lg text-sm mt-2">
                <div className="font-medium text-red-600 mb-1">Motivo de rechazo</div>
                <div className="text-red-500">{selected.rejectionReason}</div>
              </div>
            )}

            <button
              className="mt-4 w-full py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 border-none cursor-pointer"
              onClick={() => setSelected(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
