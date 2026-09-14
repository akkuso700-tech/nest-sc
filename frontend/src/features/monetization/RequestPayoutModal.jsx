import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BankIcon } from './MonetizationIcons.jsx'

export function RequestPayoutModal({
  isOpen,
  onClose,
  wallet,
  minPayoutAmount = 250,
  onSubmit,
  isSubmitting,
}) {
  const { t } = useTranslation()
  const defaultAccount = wallet?.defaultPayoutAccount || {}

  const [amount, setAmount] = useState('')
  const [fullName, setFullName] = useState(defaultAccount.fullName || '')
  const [iban, setIban] = useState(defaultAccount.iban || '')
  const [bankName, setBankName] = useState(defaultAccount.bankName || '')
  const [taxOrIdNumber, setTaxOrIdNumber] = useState(defaultAccount.taxOrIdNumber || '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (defaultAccount.fullName) setFullName(defaultAccount.fullName)
    if (defaultAccount.iban) setIban(defaultAccount.iban)
    if (defaultAccount.bankName) setBankName(defaultAccount.bankName)
    if (defaultAccount.taxOrIdNumber) setTaxOrIdNumber(defaultAccount.taxOrIdNumber)
  }, [defaultAccount])

  if (!isOpen) return null

  const availableBalance = wallet?.balance ?? 0

  const handleIbanChange = (e) => {
    let val = e.target.value.replace(/\s+/g, '').toUpperCase()
    if (!val.startsWith('TR') && val.length > 0) {
      val = 'TR' + val
    }
    // Maksimum 26 karakter
    if (val.length > 26) {
      val = val.slice(0, 26)
    }
    setIban(val)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount < minPayoutAmount) {
      setError(`Minimum çekilebilir tutar ₺${minPayoutAmount}'dir.`)
      return
    }

    if (numericAmount > availableBalance) {
      setError('Çekmek istediğiniz tutar mevcut bakiyenizden fazladır.')
      return
    }

    const cleanIban = iban.replace(/\s+/g, '').toUpperCase()
    if (!cleanIban.startsWith('TR') || cleanIban.length !== 26) {
      setError('Lütfen geçerli bir TR IBAN adresi giriniz (TR ile başlayan 26 karakter).')
      return
    }

    if (!fullName.trim()) {
      setError('Lütfen hesap sahibinin adını ve soyadını giriniz.')
      return
    }

    try {
      await onSubmit({
        amount: numericAmount,
        iban: cleanIban,
        fullName: fullName.trim(),
        bankName: bankName.trim(),
        taxOrIdNumber: taxOrIdNumber.trim(),
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'Para çekim talebi oluşturulamadı.')
    }
  }

  const handleMaxAmount = () => {
    setAmount(String(availableBalance))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <BankIcon className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text">
                {t('creatorStudio.payoutModal.title', 'Banka Çekim Talebi')}
              </h3>
              <p className="text-xs text-muted">
                {t('creatorStudio.payoutModal.desc', 'FAST / EFT ile banka transferi')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-secondary cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Tutar Girişi */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <label className="font-medium text-text">
                {t('creatorStudio.payoutModal.amountLabel', 'Çekilecek Tutar (₺)')}
              </label>
              <span className="text-muted">
                Kullanılabilir:{' '}
                <button
                  type="button"
                  onClick={handleMaxAmount}
                  className="font-semibold text-primary underline underline-offset-2 cursor-pointer"
                >
                  ₺{availableBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </button>
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
                ₺
              </span>
              <input
                type="number"
                step="any"
                min={minPayoutAmount}
                max={availableBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${minPayoutAmount}.00`}
                className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-8 pr-3 text-sm font-semibold text-text placeholder:text-muted focus:border-primary focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Ad Soyad */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text">
              {t('creatorStudio.payoutModal.nameLabel', 'Hesap Sahibi Adı Soyadı')}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Adınız Soyadınız"
              className="w-full rounded-xl border border-border bg-secondary p-2.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
              required
            />
          </div>

          {/* IBAN */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text">
              {t('creatorStudio.payoutModal.ibanLabel', 'TR IBAN (26 Karakter)')}
            </label>
            <input
              type="text"
              value={iban}
              onChange={handleIbanChange}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              className="w-full rounded-xl border border-border bg-secondary p-2.5 font-mono text-xs tracking-wider text-text placeholder:text-muted focus:border-primary focus:outline-none"
              required
            />
          </div>

          {/* Banka Adı & Vergi No (Opsiyonel) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-text">
                {t('creatorStudio.payoutModal.bankLabel', 'Banka Adı (Opsiyonel)')}
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Örn: Garanti BBVA"
                className="w-full rounded-xl border border-border bg-secondary p-2 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-text">
                {t('creatorStudio.payoutModal.idLabel', 'TCKN / Vergi No')}
              </label>
              <input
                type="text"
                value={taxOrIdNumber}
                onChange={(e) => setTaxOrIdNumber(e.target.value)}
                placeholder="Yasal uyum için"
                className="w-full rounded-xl border border-border bg-secondary p-2 text-xs text-text placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-secondary cursor-pointer"
            >
              {t('common.cancel', 'Vazgeç')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableBalance < minPayoutAmount}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold !text-inverse shadow-sm transition hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'İşleniyor...' : t('creatorStudio.payoutModal.submit', 'Talebi Gönder')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
