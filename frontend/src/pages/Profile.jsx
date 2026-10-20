import { CheckCircle2, LockKeyhole, Pencil, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { ROLES } from "../lib/labels";
import { Badge, Btn, DL, Field, Modal, Notice, PageHeader, useAction } from "../components/ui";

export default function Profile() {
  const { user, updateProfile, updatePassword, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, email: user.email });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [go, busy] = useAction();

  const save = async (event) => {
    event.preventDefault();
    if (await go(() => updateProfile(form), "Profile updated")) setEditing(false);
  };
  const savePassword = async (event) => {
    event.preventDefault();
    if (await go(() => updatePassword(passwordForm), "Password updated")) {
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setPasswordModalOpen(false);
    }
  };

  return (
    <div>
      <PageHeader title="My profile" />
      <div className="grid gap-5 max-w-2xl">
        <section className="panel p-6" aria-labelledby="personal-information-title">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">Profile</p><h2 id="personal-information-title" className="mt-1 text-xl font-bold">Personal information</h2></div><Btn size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={15} />Edit profile</Btn></div>
          <DL items={[["Name", `${user.firstName} ${user.lastName}`], ["Email", user.email], ["Role", ROLES[user.role].label]]} />
        </section>

        <section className="panel p-6" aria-labelledby="security-title">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-petrol-tint text-petrol"><LockKeyhole size={18} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">Account security</p><h2 id="security-title" className="mt-1 text-xl font-bold">Security</h2></div></div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-ink-2">Password</p><p className="mt-1 font-semibold tracking-[0.2em]">••••••••</p></div><Btn variant="secondary" disabled={user.role !== "OWNER"} title={user.role === "OWNER" ? "Change password" : "Only owners can change their password"} onClick={() => setPasswordModalOpen(true)}>Change password</Btn></div>
        </section>
        <section className="panel p-5" aria-labelledby="account-title">
          <h2 id="account-title" className="text-lg font-bold">Account</h2><div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-ink-2">Status</p><Badge className="mt-1" tone="ok" icon={CheckCircle2}>Active</Badge></div><Btn variant="secondary" onClick={logout}><LogOut size={16} />Sign out</Btn></div>
        </section>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit profile">
        <form onSubmit={save} className="space-y-4">
          <Field label="First name"><input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
          <Field label="Last name"><input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          <Field label="Email"><input className="input" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2"><Btn variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Btn><Btn type="submit" busy={busy}>Save changes</Btn></div>
        </form>
      </Modal>

      <Modal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Change password">
        <form onSubmit={savePassword} className="space-y-4"><Field label="Current password"><input className="input" required type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></Field><Field label="New password"><input className="input" required type="password" minLength={6} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} /></Field><div className="flex justify-end gap-2 pt-2"><Btn variant="ghost" type="button" onClick={() => setPasswordModalOpen(false)}>Cancel</Btn><Btn type="submit" busy={busy}>Update password</Btn></div></form>
      </Modal>
    </div>
  );
}
