const mongoose = require('mongoose')

const workerLeaseSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
)

workerLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const WorkerLease = mongoose.model('WorkerLease', workerLeaseSchema)

module.exports = { WorkerLease }
