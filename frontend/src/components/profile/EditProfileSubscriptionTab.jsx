import VerifiedBadge from '../common/VerifiedBadge.jsx'
import { AlertTriangleIcon } from './EditProfileCommon.jsx'

export function EditProfileSubscriptionTab({
  user,
  verificationState,
  formState,
  categories,
  subscriptionActionState,
  setSubscriptionActionState,
  handleWithdrawPending,
  setIsVerificationModalOpen,
  confirmPlanChange,
  confirmCancelSubscription,
  t,
}) {
  return (
    <>
      <section
        id="tabpanel-abonelik-yonetimi"
        role="tabpanel"
        aria-labelledby="tab-abonelik-yonetimi"
        className="space-y-6 animate-in fade-in duration-150"
      >
        <div className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-text">
                  {t('profile.edit.subscriptionTitle', 'Abonelik & Doğrulanmış Profil Yönetimi')}
                </h2>
                {Boolean(user?.verification?.isVerified || user?.verification?.status === 'approved' || verificationState.request?.status === 'approved') && (
                  <VerifiedBadge user={{ verification: { isVerified: true } }} size="sm" />
                )}
              </div>
              <p className="text-xs text-soft mt-1">
                {t('profile.edit.subscriptionSubtitle', 'Mavi doğrulama rozetinizi, keşfet ve gösterim ayrıcalıklarınızı ve aylık aboneliğinizi bu panelden yönetebilirsiniz.')}
              </p>
            </div>

            {verificationState.isLoading && (
              <span className="text-xs text-muted">Bilgiler yükleniyor...</span>
            )}
          </div>

          {/* Durum 1: Aktif ve Onaylı Abonelik */}
          {(user?.verification?.isVerified || user?.verification?.status === 'approved' || verificationState.request?.status === 'approved') ? (
            (() => {
              const currentPlanId = user?.verification?.subscriptionPlan && user.verification.subscriptionPlan !== 'none'
                ? user.verification.subscriptionPlan
                : verificationState.request?.payment?.plan || 'plus'
              const currentPlanName = currentPlanId === 'pro' ? 'Nest Pro' : 'Nest Plus'
              const currentPlanPrice = currentPlanId === 'pro' ? 249 : 99
              const currentMultiplier = currentPlanId === 'pro' ? '5X Gösterim Desteği' : '2X Gösterim Desteği'
              const otherPlanId = currentPlanId === 'pro' ? 'plus' : 'pro'

              const currentCategory = user?.verification?.category || verificationState.request?.category || formState.category || 'individual'
              const currentCategoryObj = categories.find(([val]) => val === currentCategory) || categories[0]

              return (
                <div className="space-y-5">
                  {/* Aktif Plan Özeti Kartı */}
                  <div className="rounded-xl border border-primary/30 bg-primary/[0.03] dark:bg-primary/[0.06] p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary font-black text-base">
                          {currentPlanId === 'pro' ? 'Pro' : 'Plus'}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-text">
                              {currentPlanName}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Aktif Abonelik
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-text">
                              <span>{currentCategoryObj[2]}</span>
                              <span>{currentCategoryObj[1]}</span>
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            ₺{currentPlanPrice} / ay · {currentMultiplier}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="rounded-md bg-secondary border border-border px-2.5 py-1 text-xs font-semibold text-text">
                          Ödeme: **** 1111 (Test Kartı)
                        </span>
                      </div>
                    </div>

                    <div className="my-4 border-t border-border/50" />

                    {/* Ayrıcalık Maddeleri */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                      <div className="flex items-center gap-2 rounded-lg bg-card/70 p-2.5 border border-border/60">
                        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                          ✓
                        </span>
                        <div>
                          <p className="font-semibold text-text">{currentMultiplier}</p>
                          <p className="text-[11px] text-muted">Akış ve aramalarda üst sıralama</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-card/70 p-2.5 border border-border/60">
                        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                          ✓
                        </span>
                        <div>
                          <p className="font-semibold text-text">Mavi Rozet Aktif</p>
                          <p className="text-[11px] text-muted">Resmi onaylı profil rozeti</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg bg-card/70 p-2.5 border border-border/60">
                        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                          ✓
                        </span>
                        <div>
                          <p className="font-semibold text-text">{currentPlanId === 'pro' ? '300' : '100'} Hediye Jetonu</p>
                          <p className="text-[11px] text-muted">Aylık bahşiş bakiyesi</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Plan Değiştirme / Yükseltme Kartı */}
                  <div className="rounded-xl border border-border bg-secondary/40 p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-text">
                          {currentPlanId === 'plus'
                            ? "Daha Fazla Güç: Nest Pro'ya Yükselt"
                            : "Nest Plus Planına Geç"}
                        </h3>
                        <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                          {currentPlanId === 'plus'
                            ? "Gösterim desteğinizi 2X'ten 5X seviyesine çıkarın, VIP arama önceliği ve aylık 300 hediye jeton kazanın."
                            : "Abonelik planınızı aylık ₺99 tutarındaki Nest Plus (2X Gösterim, 100 jeton) seviyesine geçirebilirsiniz."}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSubscriptionActionState({
                            confirmModal: 'change',
                            targetPlan: otherPlanId,
                            error: '',
                            isSubmitting: false,
                          })
                        }
                        className={`shrink-0 rounded-lg px-4 py-2.5 text-xs font-bold transition cursor-pointer shadow-xs ${
                          currentPlanId === 'plus'
                            ? 'bg-primary text-inverse hover:bg-primary-hover'
                            : 'border border-border bg-card hover:bg-secondary text-text'
                        }`}
                      >
                        {currentPlanId === 'plus'
                          ? "Nest Pro'ya Yükselt (₺249 / ay)"
                          : "Nest Plus'a Geç (₺99 / ay)"}
                      </button>
                    </div>
                  </div>

                  {/* Abonelik İptal Kartı */}
                  <div className="rounded-xl border border-rose-200/60 bg-rose-50/30 dark:border-rose-900/30 dark:bg-rose-950/10 p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                          Aboneliği İptal Et
                        </h3>
                        <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                          Aboneliğinizi iptal ettiğinizde profilinizdeki onaylı mavi rozet kaldırılır ve gösterim ayrıcalıklarınız sonlandırılır. Dilediğiniz zaman tekrar abone olabilirsiniz.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSubscriptionActionState({
                            confirmModal: 'cancel',
                            targetPlan: null,
                            error: '',
                            isSubmitting: false,
                          })
                        }
                        className="shrink-0 rounded-lg border border-rose-200 bg-card px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-card dark:hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        Aboneliği İptal Et
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()
          ) : verificationState.request?.status === 'pending' || verificationState.request?.status === 'in_review' ? (
            /* Durum 2: Başvuru & Abonelik Beklemede / İnceleniyor */
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                        Başvuru İnceleniyor
                      </span>
                      <span className="text-xs font-semibold text-text">
                        {verificationState.request.payment?.plan === 'pro' ? 'Nest Pro (₺249/ay)' : 'Nest Plus (₺99/ay)'}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-text">
                      Abonelik ve Profil Doğrulama Talebiniz Alındı
                    </h3>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      Aylık test ödemeniz başarıyla alındı. Yönetim ekibi hesap bilgilerinizi inceledikten sonra mavi onay rozetiniz ve avantajlarınız aktifleşecektir.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleWithdrawPending}
                    disabled={subscriptionActionState.isSubmitting}
                    className="rounded-lg border border-rose-200 bg-card px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                  >
                    {subscriptionActionState.isSubmitting ? 'Geri çekiliyor...' : 'Başvuruyu Geri Çek'}
                  </button>
                </div>
              </div>
            </div>
          ) : verificationState.request?.status === 'needs_info' ? (
            /* Durum 3: Ek Bilgi Bekleniyor */
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                    Ek Bilgi Gerekiyor
                  </span>
                  <h3 className="mt-2 text-base font-bold text-text">Yönetim Ekibinden Not Var</h3>
                  <p className="mt-1 text-xs text-muted">
                    {verificationState.request.requestedInformation || 'Lütfen istenen ek bilgileri tamamlayınız.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVerificationModalOpen(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-inverse hover:bg-primary-hover transition cursor-pointer"
                >
                  Bilgileri Tamamla
                </button>
              </div>
            </div>
          ) : (
            /* Durum 4: Henüz Abone Değil / Yeni Başvuru Yapabilir */
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-secondary/40 p-5 sm:p-6 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <VerifiedBadge user={{ verification: { isVerified: true } }} size="md" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-text">Henüz Aktif Bir Aboneliğiniz Yok</h3>
                      <p className="text-xs text-muted mt-0.5">
                        Resmi mavi rozet kazanın, etkileşiminizi 2X veya 5X katlayın ve Üretici Stüdyosu ayrıcalıklarına erişin.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsVerificationModalOpen(true)}
                    className="shrink-0 rounded-lg bg-primary px-5 py-3 text-xs font-bold text-inverse hover:bg-primary-hover transition cursor-pointer shadow-xs"
                  >
                    Abonelik Başlat ve Mavi Rozet Al
                  </button>
                </div>
              </div>

              {/* Planlar Karşılaştırma Vitrini */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-text">Nest Plus</span>
                    <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-text">Popüler</span>
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-text">₺99 <span className="text-xs font-normal text-muted">/ ay</span></p>
                  <div className="my-3 border-t border-border/50" />
                  <ul className="space-y-2 text-xs text-muted">
                    <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> 2X Daha Fazla Gösterim Desteği</li>
                    <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Profilde Resmi Mavi Onay Rozeti</li>
                    <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Üretici Stüdyosu Temel Erişim</li>
                    <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> 100 Hediye Jetonu</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-primary/25 bg-primary/[0.02] p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-text">Nest Pro</span>
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">Maksimum Güç</span>
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-text">₺249 <span className="text-xs font-normal text-muted">/ ay</span></p>
                  <div className="my-3 border-t border-border/50" />
                  <ul className="space-y-2 text-xs text-muted">
                    <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> 5X Daha Fazla Gösterim Desteği (Maksimum Keşfet)</li>
                    <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Mavi Rozet & VIP Öncelikli Destek</li>
                    <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> Üretici Stüdyosu Gelişmiş Gelir Analitiği</li>
                    <li className="flex items-center gap-2"><span className="text-primary font-bold">✓</span> 300 Hediye Jetonu</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Plan Değiştirme ve İptal Onay Modalı */}
      {subscriptionActionState.confirmModal && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {subscriptionActionState.confirmModal === 'change' ? (
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <VerifiedBadge user={{ verification: { isVerified: true } }} size="md" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-text">
                      {subscriptionActionState.targetPlan === 'pro'
                        ? "Nest Pro Planına Yükselt"
                        : "Nest Plus Planına Geç"}
                    </h3>
                    <p className="text-xs text-muted">
                      {subscriptionActionState.targetPlan === 'pro'
                        ? 'Aylık ₺249 · 5X Gösterim Desteği & VIP Avantajlar'
                        : 'Aylık ₺99 · 2X Gösterim Desteği'}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  {subscriptionActionState.targetPlan === 'pro'
                    ? 'Aboneliğinizi Nest Pro seviyesine yükseltmek üzeresiniz. Gösterim desteğiniz 5X seviyesine çıkarılacak, akışta ve aramalarda en üst sırada listeleneceksiniz.'
                    : 'Aboneliğinizi Nest Plus seviyesine düşürmek üzeresiniz. Bir sonraki yenilenme döneminizde aylık ₺99 tahsil edilecektir.'}
                </p>

                {subscriptionActionState.error ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                    {subscriptionActionState.error}
                  </div>
                ) : null}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={subscriptionActionState.isSubmitting}
                    onClick={() =>
                      setSubscriptionActionState({
                        confirmModal: null,
                        targetPlan: null,
                        error: '',
                        isSubmitting: false,
                      })
                    }
                    className="rounded-lg border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-text hover:bg-secondary-hover transition cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={subscriptionActionState.isSubmitting}
                    onClick={confirmPlanChange}
                    className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-inverse hover:bg-primary-hover transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {subscriptionActionState.isSubmitting ? 'İşleniyor...' : 'Onayla ve Değiştir'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <AlertTriangleIcon />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
                      Aboneliği İptal Et
                    </h3>
                    <p className="text-xs text-muted">Mavi rozet ve gösterim avantajları sonlandırılacaktır</p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Aboneliğinizi iptal ettiğinizde profilinizdeki mavi doğrulama rozeti ve 2X/5X keşfet desteği kaldırılacaktır. Dilediğiniz zaman tekrar abone olabilirsiniz.
                </p>

                {subscriptionActionState.error ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                    {subscriptionActionState.error}
                  </div>
                ) : null}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={subscriptionActionState.isSubmitting}
                    onClick={() =>
                      setSubscriptionActionState({
                        confirmModal: null,
                        targetPlan: null,
                        error: '',
                        isSubmitting: false,
                      })
                    }
                    className="rounded-lg border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-text hover:bg-secondary-hover transition cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={subscriptionActionState.isSubmitting}
                    onClick={confirmCancelSubscription}
                    className="rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {subscriptionActionState.isSubmitting ? 'İptal Ediliyor...' : 'Evet, Aboneliği İptal Et'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
