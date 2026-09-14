const monetizationService = require('../services/monetizationService')

async function getStatus(req, res, next) {
  try {
    const status = await monetizationService.getMonetizationStatus(req.user._id)
    res.json({ success: true, data: status })
  } catch (error) {
    next(error)
  }
}

async function apply(req, res, next) {
  try {
    const { statement } = req.body || {}
    const result = await monetizationService.applyForMonetization(req.user._id, {
      statement,
    })
    res.status(201).json({
      success: true,
      message: result.autoApproved
        ? 'Başvurunuz onaylandı! Üretici Stüdyosu erişiminiz açıldı.'
        : 'Başvurunuz alındı ve incelemeye gönderildi.',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

async function getDashboard(req, res, next) {
  try {
    const dashboard = await monetizationService.getCreatorDashboard(req.user._id)
    res.json({ success: true, data: dashboard })
  } catch (error) {
    next(error)
  }
}

async function postPayoutRequest(req, res, next) {
  try {
    const { amount, iban, fullName, bankName, taxOrIdNumber } = req.body || {}
    const payout = await monetizationService.requestPayout(req.user._id, {
      amount,
      iban,
      fullName,
      bankName,
      taxOrIdNumber,
    })
    res.status(201).json({
      success: true,
      message: 'Para çekim talebiniz başarıyla oluşturuldu.',
      data: payout,
    })
  } catch (error) {
    next(error)
  }
}

async function saveAccount(req, res, next) {
  try {
    const { iban, fullName, bankName, taxOrIdNumber } = req.body || {}
    const account = await monetizationService.savePayoutAccount(req.user._id, {
      iban,
      fullName,
      bankName,
      taxOrIdNumber,
    })
    res.json({
      success: true,
      message: 'Banka ve ödeme bilgileriniz kaydedildi.',
      data: account,
    })
  } catch (error) {
    next(error)
  }
}

async function simulate(req, res, next) {
  try {
    const { type, amount } = req.body || {}
    const wallet = await monetizationService.simulateEarning(req.user._id, {
      type,
      amount,
    })
    res.json({
      success: true,
      message: 'Demo bakiye yüklendi.',
      data: wallet,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getStatus,
  apply,
  getDashboard,
  postPayoutRequest,
  saveAccount,
  simulate,
}
