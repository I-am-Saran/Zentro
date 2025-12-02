import { useState } from 'react'
import { X } from 'lucide-react'
import FormInput from '../../components/FormInput'

const productOptions = ["ALTEC XDM", "TRADE AI", "NEBULA AI"]
const componentOptions = [
  "Collection",
  "Dashboard",
  "Discrepancy",
  "Filters",
  "GRN History",
  "Inventory (Saleable / Non-Saleable)",
]
const versionOptions = ["Regression", "V2", "V3"]
const severityOptions = ["Blocker", "Critical", "Major", "Minor", "Trivial"]
const hardwareOptions = ["PC", "Mobile", "Tablet", "Other"]
const osOptions = ["Windows", "MacOS", "Linux", "Android", "iOS"]
const defectTypes = ["Functional", "UI", "Performance", "Security", "Compatibility"]
const ticketTypes = ["Bug", "Change Request", "New Feature"]
const browsers = ["Chrome", "Firefox", "Edge", "Safari", "Opera"]
const testingPhases = ["System Test", "Regression", "UAT", "Smoke"]

export default function CreateBugForm({ onClose }) {
  const [form, setForm] = useState({
    product: '',
    components: [],
    version: '',
    severity: '',
    hardware: '',
    os: '',
    reproSteps: '',
    defectType: '',
    ticketType: '',
    sprintDetails: '',
    browserTested: '',
    testingPhase: '',
    projectOwner: '',
    summary: '',
    description: '',
    attachments: [],
  })

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const toggleComponent = (comp) => {
    setForm(prev => {
      const exists = prev.components.includes(comp)
      return { ...prev, components: exists ? prev.components.filter(c => c !== comp) : [...prev.components, comp] }
    })
  }

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    updateField('attachments', files)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    console.log('New Bug:', form)
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-label="Create Bug Form"
        className="relative w-[95%] max-w-5xl bg-white rounded-xl border border-[#DDE6D5] shadow-xl"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE6D5]">
          <h2 className="text-xl font-semibold text-primary">Create New Bug</h2>
          <button aria-label="Close" onClick={onClose} className="p-2 rounded hover:bg-card text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={onSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              <FormInput
                type="select"
                label="Product"
                value={form.product}
                onChange={e => updateField('product', e.target.value)}
                options={productOptions}
                placeholder="Select product"
                required
              />

              <FormInput
                type="select"
                label="Version"
                value={form.version}
                onChange={e => updateField('version', e.target.value)}
                options={versionOptions}
                placeholder="Select version"
                required
              />

              <FormInput
                type="select"
                label="Severity"
                value={form.severity}
                onChange={e => updateField('severity', e.target.value)}
                options={severityOptions}
                placeholder="Select severity"
                required
              />

              <FormInput
                type="select"
                label="Hardware"
                value={form.hardware}
                onChange={e => updateField('hardware', e.target.value)}
                options={hardwareOptions}
                placeholder="Select hardware"
                required
              />

              <FormInput
                type="select"
                label="OS"
                value={form.os}
                onChange={e => updateField('os', e.target.value)}
                options={osOptions}
                placeholder="Select OS"
                required
              />

              <FormInput
                type="textarea"
                label="Reproducible Steps"
                value={form.reproSteps}
                onChange={e => updateField('reproSteps', e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <FormInput
                type="select"
                label="Defect Type"
                value={form.defectType}
                onChange={e => updateField('defectType', e.target.value)}
                options={defectTypes}
                placeholder="Select defect type"
                required
              />

              <FormInput
                type="select"
                label="Ticket Type"
                value={form.ticketType}
                onChange={e => updateField('ticketType', e.target.value)}
                options={ticketTypes}
                placeholder="Select ticket type"
                required
              />

              <FormInput
                type="text"
                label="Sprint Details"
                value={form.sprintDetails}
                onChange={e => updateField('sprintDetails', e.target.value)}
                placeholder="Enter sprint details"
              />

              <FormInput
                type="select"
                label="Browser Tested"
                value={form.browserTested}
                onChange={e => updateField('browserTested', e.target.value)}
                options={browsers}
                placeholder="Select browser"
              />

              <FormInput
                type="select"
                label="Testing Phase"
                value={form.testingPhase}
                onChange={e => updateField('testingPhase', e.target.value)}
                options={testingPhases}
                placeholder="Select phase"
              />

              <FormInput
                type="text"
                label="Project Owner"
                value={form.projectOwner}
                onChange={e => updateField('projectOwner', e.target.value)}
                placeholder="Enter project owner name"
              />
            </div>
          </div>

          {/* Full-width fields */}
          <div className="mt-6 space-y-4">
            {/* Components multi-select */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">Component <span className="text-primary">*</span></label>
              <div className="flex flex-wrap gap-2">
                {componentOptions.map(opt => (
                  <label key={opt} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#DDE6D5] cursor-pointer select-none">
                    <input type="checkbox" className="accent-primary" checked={form.components.includes(opt)} onChange={() => toggleComponent(opt)} />
                    <span className="text-sm text-text">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <FormInput
              type="text"
              label="Summary"
              value={form.summary}
              onChange={e => updateField('summary', e.target.value)}
              placeholder="Brief summary of the bug"
              required
            />

            <FormInput
              type="textarea"
              label="Description"
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="Detailed description"
              rows={5}
              required
            />

            {/* Attachment */}
            <div>
              <label htmlFor="attachments" className="block text-sm font-medium text-text mb-1">Attachment</label>
              <input id="attachments" type="file" multiple onChange={onFileChange}
                     className="w-full rounded-xl border border-[#DDE6D5] p-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white hover:file:bg-[#3B4E41]" />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="bg-white text-primary border border-[#DDE6D5] px-4 py-2 rounded-lg hover:bg-accent">
              Cancel
            </button>
            <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-[#3B4E41] btn-glow">
              Submit Bug
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}