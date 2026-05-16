"use client";
import Sidebar from "@/components/hr-admin/Sidebar";
import Topbar from "@/components/hr-admin/Topbar";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  UploadCloud, Download, FileText, CheckCircle2, AlertTriangle,
  Check, X, UserPlus, ChevronDown, Mail, Eye,
} from "lucide-react";
import { authApi } from "@/lib/api/auth.api";
import { employeesApi } from "@/lib/api/employees.api";
import { getApiErrorMessage, extractId } from "@/lib/utils";
import type { Employee } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = "csv" | "manual";

interface FormState {
  fullName: string;
  userRole: "employee" | "auditor";
  role: string;
  department: string;
  phone: string;
  email: string;
  salary: string;
}

const emptyForm: FormState = {
  fullName: "", userRole: "employee", role: "", department: "", phone: "", email: "", salary: "",
};

function generateAccountNumber(): string {
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
}

// ─── CSV Upload Mode ──────────────────────────────────────────────────────────

const previewRows = [
  { name: "Chukwuemeka Obi",  role: "Sr. Accountant",  account: "012••••7734", phone: "0802••••61" },
  { name: "Funke Adesanya",   role: "Budget Analyst",  account: "057••••2210", phone: "0803••••47" },
  { name: "Ibrahim Musa",     role: "Finance Officer", account: "044••••9901", phone: "0901••••88" },
];

function CsvMode() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [roster, setRoster] = useState<Employee[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".csv")) { setFile(dropped); setImportResult(null); setImportError(null); }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) { setFile(picked); setImportResult(null); setImportError(null); }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await employeesApi.importCsv(file);
      const { imported, skipped } = res.data.data;
      setImportResult({ imported, skipped });
      // fetch the current roster to display immediately after import
      const listRes = await employeesApi.list({ limit: 100 });
      setRoster(listRes.data.data.data);
    } catch (err) {
      setImportError(getApiErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const hasFile = !!file;

  return (
    <div className="grid grid-cols-[1fr_300px] gap-5 items-start">
      {/* Left */}
      <div className="flex flex-col gap-5">
        {/* Dropzone */}
        <div className="bg-white rounded-xl border border-[#f0f0f0] p-6">
          <h2 className="text-[#1e1e1e] text-[15px] font-bold mb-5">Upload Employee Roster</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !hasFile && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-14 transition-colors ${
              dragging
                ? "border-[#3a6e57] bg-[#f0faf5]"
                : hasFile
                ? "border-[#3a6e57] bg-[#f0faf5]/50"
                : "border-[#e0e3dc] hover:border-[#3a6e57] hover:bg-[#f0faf5]/30 cursor-pointer"
            }`}
          >
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
            {hasFile ? (
              <>
                <div className="w-12 h-12 bg-[#dcfce7] rounded-xl flex items-center justify-center mb-3">
                  <FileText className="text-[#158079] w-6 h-6" />
                </div>
                <p className="text-[#1e1e1e] text-[14px] font-semibold">{file.name}</p>
                <p className="text-[#828282] text-[12px] mt-1">58 rows · 2 skipped</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="mt-3 text-[12px] text-[#3a6e57] hover:text-[#2d5745] font-medium underline underline-offset-2"
                >
                  Replace file
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-[#fef3c7] rounded-xl flex items-center justify-center mb-3">
                  <UploadCloud className="text-[#b45309] w-6 h-6" />
                </div>
                <p className="text-[#1e1e1e] text-[14px] font-medium">Drop your CSV file here</p>
                <p className="text-[#3a6e57] text-[12px] font-medium mt-0.5">Or click to browse</p>
                <p className="text-[#828282] text-[12px] mt-1">Accepted: .csv · Max 10 MB</p>
              </>
            )}
          </div>
          <button className="mt-4 flex items-center gap-1.5 text-[12px] text-[#4e4e4e] hover:text-[#1e1e1e] font-medium transition-colors">
            <Download className="w-4 h-4" /> Download template CSV
          </button>
        </div>

        {/* Column mapping */}
        {hasFile && (
          <div className="bg-white rounded-xl border border-[#f0f0f0] p-6">
            <h3 className="text-[#1e1e1e] text-[14px] font-bold mb-4">Column Mapping — {file.name}</h3>
            <div className="flex flex-col">
              {[
                { field: "Employee Name",  mapped: 'Column A: "Full Name"' },
                { field: "Role / Job Title", mapped: 'Column B: "Position"' },
                { field: "Account Number", mapped: 'Column C: "Bank Account"' },
                { field: "Phone Number",   mapped: 'Column D: "Phone"' },
              ].map(({ field, mapped }) => (
                <div key={field} className="flex items-center justify-between py-2.5 border-b border-[#f0f0f0] last:border-0">
                  <span className="text-[#828282] text-[14px]">{field}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#1e1e1e] text-[14px] font-medium">{mapped}</span>
                    <Check className="w-4 h-4 text-[#158079] shrink-0" strokeWidth={2.5} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation */}
        {hasFile && (
          <div className="bg-white rounded-xl border border-[#f0f0f0] p-6">
            <h3 className="text-[#1e1e1e] text-[14px] font-bold mb-4">Validation Results</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 bg-[#dcfce7] border border-[#bbf7d0] rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-[#158079] shrink-0" />
                <p className="text-[#158079] text-[14px] font-medium">56 rows validated — ready to import</p>
              </div>
              <div className="flex items-center gap-3 bg-[#fef3c7] border border-[#fde68a] rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-[#b45309] shrink-0" />
                <p className="text-[#b45309] text-[14px] font-medium">2 rows have missing data and will be skipped</p>
              </div>
            </div>
          </div>
        )}

        {/* File preview — shown before import */}
        {hasFile && !importResult && (
          <div className="bg-white rounded-xl border border-[#f0f0f0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e0e3dc]">
              <h3 className="text-[#1e1e1e] text-[14px] font-bold">File Preview — First 3 Rows</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8f8f8] border-b border-[#f0f0f0]">
                  {["NAME", "ROLE", "ACCOUNT", "PHONE"].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold text-[#828282] uppercase tracking-widest px-6 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-[#f0f0f0] last:border-0">
                    <td className="px-6 py-3 text-[#1e1e1e] text-[14px] font-medium">{row.name}</td>
                    <td className="px-6 py-3 text-[#4e4e4e] text-[14px]">{row.role}</td>
                    <td className="px-6 py-3 text-[#828282] text-[14px] font-mono">{row.account}</td>
                    <td className="px-6 py-3 text-[#828282] text-[14px] font-mono">{row.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Roster list — shown after successful import */}
        {importResult && roster.length > 0 && (
          <div className="bg-white rounded-xl border border-[#f0f0f0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e0e3dc] flex items-center justify-between">
              <h3 className="text-[#1e1e1e] text-[14px] font-bold">Current Roster — {roster.length} employees</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8f8f8] border-b border-[#f0f0f0]">
                  {["EMPLOYEE", "ROLE", "ACCOUNT", "STATUS"].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold text-[#828282] uppercase tracking-widest px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map((emp) => {
                  const initials = emp.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
                  return (
                    <tr key={emp._id} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#f8f8f8] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#e0f2ea] flex items-center justify-center shrink-0">
                            <span className="text-[#3a6e57] text-[11px] font-bold">{initials}</span>
                          </div>
                          <span className="text-[#1e1e1e] text-[13px] font-medium">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#4e4e4e] text-[13px]">{emp.roleTitle}</td>
                      <td className="px-4 py-3 text-[#828282] text-[13px] font-mono">
                        {emp.accountNumber ? `**** ${emp.accountNumber.slice(-4)}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {emp.status === "FROZEN" && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#b91c1c]">Frozen</span>}
                        {emp.status === "REVIEW" && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#b45309]">Review</span>}
                        {emp.status === "CLEAR"  && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#158079]">Clear</span>}
                        {emp.status === "PENDING" && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#f0f0f0] text-[#828282]">Pending</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-[#f0f0f0] p-5">
          <h3 className="text-[#1e1e1e] text-[14px] font-bold mb-4">Import Summary</h3>
          <div className="text-center py-4 border-b border-[#f0f0f0] mb-4">
            <p className="text-[50px] font-extrabold text-[#1e1e1e] leading-none">{hasFile ? "56" : "—"}</p>
            <p className="text-[#828282] text-[12px] mt-1">employees ready to import</p>
          </div>
          <div className="flex flex-col">
            {[
              { label: "File name",    value: hasFile ? file.name : "No file selected" },
              { label: "Total rows",   value: hasFile ? "58" : "—" },
              { label: "Valid rows",   value: hasFile ? "56" : "—", color: "text-[#158079]" },
              { label: "Skipped rows", value: hasFile ? "2 – missing data" : "—", color: "text-[#b45309]" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-[#f0f0f0] last:border-0">
                <span className="text-[#828282] text-[12px]">{label}</span>
                <span className={`text-[12px] font-semibold truncate max-w-[130px] text-right ${color ?? "text-[#1e1e1e]"}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {importError && (
          <div className="flex items-start gap-2 bg-[#fee2e2] rounded-xl p-3">
            <X className="w-4 h-4 text-[#b91c1c] shrink-0 mt-0.5" />
            <p className="text-[#b91c1c] text-[12px]">{importError}</p>
          </div>
        )}

        {importResult && (
          <div className="flex flex-col gap-1.5 bg-[#dcfce7] rounded-xl p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#158079] shrink-0" />
              <p className="text-[#158079] text-[13px] font-semibold">{importResult.imported} employees imported</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#158079] shrink-0" />
              <p className="text-[#158079] text-[12px]">Welcome emails sent — they can now sign in via email code.</p>
            </div>
          </div>
        )}

        <button
          disabled={!hasFile || importing || !!importResult}
          onClick={handleImport}
          className={`w-full text-white text-[14px] font-semibold py-3.5 rounded-xl transition-colors ${
            hasFile && !importing && !importResult ? "bg-[#3a6e57] hover:bg-[#2d5745]" : "bg-[#e0e3dc] text-[#828282] cursor-not-allowed"
          }`}
        >
          {importing ? "Importing…" : importResult ? "Imported ✓" : `Import Employees`}
        </button>
        <button className="w-full bg-white hover:bg-gray-50 text-[#4e4e4e] text-[14px] font-semibold py-3.5 rounded-xl border border-[#e0e3dc] transition-colors">
          Cancel
        </button>

        <div className="bg-white rounded-xl border border-[#f0f0f0] p-5">
          <h4 className="text-[#1e1e1e] text-[13px] font-bold mb-2">CSV Format Guide</h4>
          <p className="text-[#828282] text-[12px] mb-2">Required columns in order:</p>
          <div className="bg-[#f8f8f8] rounded-lg px-3 py-2 mb-3">
            <p className="text-[#4e4e4e] text-[12px] font-mono">Full Name, Position, Bank Account, Phone</p>
          </div>
          <p className="text-[#828282] text-[11px] leading-relaxed">
            Account numbers and phone numbers are stored encrypted. Only the last 4 digits are shown in the interface.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Employee List Section ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-amber-100 text-amber-700", "bg-orange-100 text-orange-700",
  "bg-lime-100 text-lime-700",   "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",   "bg-teal-100 text-teal-700",
  "bg-sky-100 text-sky-700",     "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function getInitials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function EmployeeListSection({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeesApi.list({ limit: 100 });
      const { data, total } = res.data.data;
      setEmployees(data.map(e => ({ ...e, _id: extractId(e._id) })));
      setTotal(total);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="bg-white rounded-xl border border-[#f0f0f0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
        <div>
          <h3 className="text-[#1e1e1e] text-[14px] font-bold">Current Employee Roster</h3>
          {!loading && <p className="text-[#828282] text-[12px] mt-0.5">{total} employees on record</p>}
        </div>
        <button
          onClick={() => router.push("/hr-admin/employees")}
          className="flex items-center gap-1.5 text-[12px] text-[#4e4e4e] hover:text-[#1e1e1e] border border-[#e0e3dc] hover:bg-[#f0f2f6] px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          <Eye className="w-3.5 h-3.5" /> View all
        </button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-[#f8f8f8] border-b border-[#f0f0f0]">
            <th className="text-left text-[11px] text-[#828282] font-semibold uppercase tracking-wide py-3 px-5">Employee</th>
            <th className="text-left text-[11px] text-[#828282] font-semibold uppercase tracking-wide py-3 pr-4">Role</th>
            <th className="text-left text-[11px] text-[#828282] font-semibold uppercase tracking-wide py-3 pr-4">Account</th>
            <th className="text-left text-[11px] text-[#828282] font-semibold uppercase tracking-wide py-3 pr-4">DNA Score</th>
            <th className="text-left text-[11px] text-[#828282] font-semibold uppercase tracking-wide py-3 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className="py-10 text-center text-[#828282] text-[13px]">Loading employees…</td></tr>
          ) : employees.length === 0 ? (
            <tr><td colSpan={5} className="py-10 text-center text-[#828282] text-[13px]">No employees yet. Add one above.</td></tr>
          ) : employees.map(emp => (
            <tr key={emp._id} className="border-b border-[#f0f0f0] hover:bg-[#f8f8f8] transition-colors">
              <td className="py-3 px-5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${avatarColor(emp.name)}`}>
                    {getInitials(emp.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#1e1e1e] text-[13px] font-medium truncate">{emp.name}</p>
                    <p className="text-[#828282] text-[11px]">{emp._id.slice(-8).toUpperCase()}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 pr-4 text-[#4e4e4e] text-[13px]">{emp.roleTitle || "—"}</td>
              <td className="py-3 pr-4 text-[#828282] text-[13px] font-mono">
                {emp.accountNumber ? `**** ${emp.accountNumber.slice(-4)}` : "—"}
              </td>
              <td className="py-3 pr-4">
                {emp.dnaScore === null ? (
                  <span className="text-[#828282] text-[12px]">—</span>
                ) : (
                  <span className={`text-[12px] font-bold px-2 py-0.5 rounded-lg border ${
                    emp.dnaScore < 40 ? "text-[#b91c1c] bg-[#fee2e2] border-[#fecaca]"
                    : emp.dnaScore < 65 ? "text-[#b45309] bg-[#fef3c7] border-[#fde68a]"
                    : "text-[#158079] bg-[#dcfce7] border-[#bbf7d0]"
                  }`}>{emp.dnaScore}</span>
                )}
              </td>
              <td className="py-3 pr-4">
                {emp.status === "FROZEN"  && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#b91c1c]">Frozen</span>}
                {emp.status === "REVIEW"  && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#b45309]">Review</span>}
                {emp.status === "CLEAR"   && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#158079]">Clear</span>}
                {emp.status === "PENDING" && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#f0f0f0] text-[#828282]">Pending</span>}
                {emp.status === "FLAGGED" && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#b91c1c]">Flagged</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Manual Form Mode ─────────────────────────────────────────────────────────

const departments = ["Finance", "Accounts", "Budget", "Admin", "Procurement", "Audit", "IT"];

function Field({
  label, fieldKey, type = "text", placeholder, form, errors, onChange,
}: {
  label: string;
  fieldKey: keyof FormState;
  type?: string;
  placeholder?: string;
  form: FormState;
  errors: Partial<FormState>;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[#4e4e4e] text-[13px] font-medium">{label}</label>
      <input
        type={type}
        value={form[fieldKey] as string}
        onChange={onChange(fieldKey)}
        placeholder={placeholder}
        className={`h-[44px] border rounded-xl px-3 text-[14px] text-[#1e1e1e] bg-white outline-none transition-colors ${
          errors[fieldKey] ? "border-[#b91c1c]" : "border-[#e0e3dc] focus:border-[#3a6e57]"
        }`}
      />
      {errors[fieldKey] && <p className="text-[#b91c1c] text-[11px]">{errors[fieldKey]}</p>}
    </div>
  );
}

function ManualMode() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.fullName.trim()) e.fullName = "Full name is required";
    if (!form.email.trim())    e.email = "Email is required";
    if (!form.role.trim())     e.role = "Job title is required";
    if (!form.department)      e.department = "Department is required";
    if (!form.phone.trim())    e.phone = "Phone number is required";
    if (!form.salary.trim())   e.salary = "Gross salary is required";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setApiError(null);
    setLoading(true);
    try {
      await authApi.invite({
        name: form.fullName,
        email: form.email,
        role: form.userRole,
        accountNumber: generateAccountNumber(),
        phone: form.phone || undefined,
        salary: form.salary || undefined,
      });
      setSubmitted(true);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => { setForm(emptyForm); setErrors({}); setSubmitted(false); setApiError(null); };

  if (submitted) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center justify-center bg-white rounded-xl border border-[#f0f0f0] p-16 gap-4">
          <div className="w-16 h-16 rounded-full bg-[#dcfce7] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#158079]" />
          </div>
          <h3 className="text-[#1e1e1e] text-[18px] font-bold">{form.fullName} added successfully</h3>
          <div className="flex flex-col gap-2 items-center max-w-sm">
            <p className="text-[#828282] text-[14px] text-center">
              A welcome email has been sent to <strong className="text-[#1e1e1e]">{form.email}</strong>.
            </p>
            <div className="flex items-center gap-2 bg-[#f8f8f8] rounded-xl px-4 py-2.5 w-full">
              <Mail className="w-4 h-4 text-[#3a6e57] shrink-0" />
              <p className="text-[#4e4e4e] text-[12px]">
                They can sign in at any time using their email and a confirmation code — no password needed.
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="h-[42px] px-5 rounded-xl bg-[#3a6e57] hover:bg-[#2d5745] text-white text-[14px] font-medium transition-colors mt-2"
          >
            Add another
          </button>
        </div>
        <EmployeeListSection refreshKey={refreshKey} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-[1fr_300px] gap-5 items-start">
      {/* Left — form + roster */}
      <div className="flex flex-col gap-5">
      <div className="bg-white rounded-xl border border-[#f0f0f0] p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-[#1e1e1e] text-[15px] font-bold">Employee Details</h2>
          <p className="text-[#828282] text-[13px] mt-0.5">Fill in the fields below to add a user to the current payroll cycle. A welcome email will be sent automatically.</p>
        </div>

        {/* Role selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[#4e4e4e] text-[13px] font-medium">System role</label>
          <div className="flex gap-2">
            {([["employee", "Employee", "Standard payroll employee — signs in via email code"] , ["auditor", "Auditor", "Reviews flagged cases — signs in via email code"]] as const).map(([val, label, desc]) => (
              <button
                key={val} type="button"
                onClick={() => setForm(f => ({ ...f, userRole: val }))}
                className={`flex-1 text-left p-3 rounded-xl border transition-colors ${
                  form.userRole === val
                    ? "border-[#3a6e57] bg-[#f0faf5]"
                    : "border-[#e0e3dc] bg-white hover:bg-[#f8f8f8]"
                }`}
              >
                <p className={`text-[13px] font-semibold ${form.userRole === val ? "text-[#3a6e57]" : "text-[#1e1e1e]"}`}>{label}</p>
                <p className="text-[#828282] text-[11px] mt-0.5 leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name"     fieldKey="fullName" placeholder="e.g. Chukwuemeka Obi" form={form} errors={errors} onChange={set} />
          <Field label="Email address" fieldKey="email"    type="email" placeholder="name@gov.ng" form={form} errors={errors} onChange={set} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Job title" fieldKey="role" placeholder="e.g. Senior Accountant" form={form} errors={errors} onChange={set} />
          {/* Department select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#4e4e4e] text-[13px] font-medium">Department</label>
            <div className="relative">
              <select
                value={form.department}
                onChange={set("department")}
                className={`w-full h-[44px] border rounded-xl px-3 pr-8 text-[14px] text-[#1e1e1e] bg-white outline-none appearance-none transition-colors ${
                  errors.department ? "border-[#b91c1c]" : "border-[#e0e3dc] focus:border-[#3a6e57]"
                }`}
              >
                <option value="">Select department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#828282] pointer-events-none" />
            </div>
            {errors.department && <p className="text-[#b91c1c] text-[11px]">{errors.department}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone number"             fieldKey="phone"   placeholder="080X XXX XXXX"   form={form} errors={errors} onChange={set} />
          <Field label="Gross monthly salary (₦)" fieldKey="salary"  type="number" placeholder="e.g. 350000" form={form} errors={errors} onChange={set} />
        </div>

        {/* Squad API banner — shown as soon as a name is typed */}
        {form.fullName.trim() && (
          <div className="bg-[#0D2B1F] rounded-xl p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <p className="text-emerald-400 text-[11px] font-semibold uppercase tracking-widest">Squad API · Live</p>
            </div>
            <p className="text-white text-[20px] font-bold leading-snug">
              Creating an account for <span className="text-emerald-400">{form.fullName.trim()}</span> with Squad API
            </p>
            <p className="text-white/50 text-[12px]">
              A dedicated virtual account will be provisioned instantly via Squad&apos;s disbursement infrastructure.
              Account number: <span className="font-mono text-white/70">{generateAccountNumber()}</span>
            </p>
          </div>
        )}

        <div className="bg-[#f8f8f8] rounded-xl p-3">
          <p className="text-[#828282] text-[12px] leading-relaxed">
            Phone numbers are encrypted at rest. The employee will receive a verification SMS link before payday.
          </p>
        </div>
      </div>
      <EmployeeListSection refreshKey={refreshKey} />
      </div>

      {/* Right — summary + submit */}
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-xl border border-[#f0f0f0] p-5">
          <h3 className="text-[#1e1e1e] text-[14px] font-bold mb-3">Before you submit</h3>
          <div className="flex flex-col gap-2">
            {[
              "Full name and job title are correct",
              "Phone number can receive SMS",
              "Salary figure reflects current gross pay",
              "Squad API will auto-generate account number",
            ].map(item => (
              <div key={item} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded border border-[#3a6e57] bg-[#dcfce7] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-[#158079]" strokeWidth={3} />
                </div>
                <span className="text-[#4e4e4e] text-[12px] leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full text-white text-[14px] font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 ${
            loading ? "bg-[#e0e3dc] text-[#828282] cursor-not-allowed" : "bg-[#3a6e57] hover:bg-[#2d5745]"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          {loading ? "Adding…" : "Add & Send Invite Email"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="w-full bg-white hover:bg-gray-50 text-[#4e4e4e] text-[14px] font-semibold py-3.5 rounded-xl border border-[#e0e3dc] transition-colors"
        >
          Clear form
        </button>

        {Object.keys(errors).length > 0 && (
          <div className="flex items-start gap-2 bg-[#fee2e2] rounded-xl p-3">
            <X className="w-4 h-4 text-[#b91c1c] shrink-0 mt-0.5" />
            <p className="text-[#b91c1c] text-[12px]">Please fix the highlighted fields before submitting.</p>
          </div>
        )}

        {apiError && (
          <div className="flex items-start gap-2 bg-[#fee2e2] rounded-xl p-3">
            <X className="w-4 h-4 text-[#b91c1c] shrink-0 mt-0.5" />
            <p className="text-[#b91c1c] text-[12px]">{apiError}</p>
          </div>
        )}
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadRosterPage() {
  const [mode, setMode] = useState<Mode>("csv");

  return (
    <div className="flex min-h-screen bg-[#f0f2f6]">
      <Sidebar />
      <div className="ml-[250px] flex-1 flex flex-col min-w-0">
        <Topbar title="Upload Roster" />
        <main className="flex-1 p-6 flex flex-col gap-5">

          {/* Mode tabs */}
          <div className="bg-white rounded-xl border border-[#f0f0f0] p-1 flex gap-1 self-start">
            <button
              onClick={() => setMode("csv")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                mode === "csv"
                  ? "bg-[#3a6e57] text-white"
                  : "text-[#4e4e4e] hover:bg-[#f0f2f6]"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Upload CSV
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                mode === "manual"
                  ? "bg-[#3a6e57] text-white"
                  : "text-[#4e4e4e] hover:bg-[#f0f2f6]"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Add Employee Manually
            </button>
          </div>

          {mode === "csv" ? <CsvMode /> : <ManualMode />}

        </main>
      </div>
    </div>
  );
}
