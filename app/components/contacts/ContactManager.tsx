"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Contact = {
  id: string;
  phone: string;
  contact_name?: string | null;
  profile_name?: string | null;
  name_prefix?: string | null;
  job_position?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

type PropertyOption = {
  id: string;
  client_code: string;
  property_name: string;
};

type ContactForm = {
  id: string;
  phone: string;
  contact_name: string;
  name_prefix: string;
  job_position: string;
  property_id: string;
  notes: string;
  is_active: boolean;
};

const blankContact = (propertyId = ""): ContactForm => ({
  id: "",
  phone: "",
  contact_name: "",
  name_prefix: "",
  job_position: "",
  property_id: propertyId,
  notes: "",
  is_active: true,
});

function toForm(contact: Contact, propertyId = ""): ContactForm {
  return {
    ...blankContact(propertyId),
    id: contact.id,
    phone: contact.phone || "",
    contact_name: contact.contact_name || contact.profile_name || "",
    name_prefix: contact.name_prefix || "",
    job_position: contact.job_position || "",
    property_id: contact.property_id || propertyId,
    notes: contact.notes || "",
    is_active: contact.is_active !== false,
  };
}

export default function ContactManager({
  master,
  propertyId,
  propertyName,
  initialContactId,
  variant = "modal",
  onClose,
  onChanged,
}: {
  master: boolean;
  propertyId?: string;
  propertyName?: string;
  initialContactId?: string;
  variant?: "modal" | "embedded";
  onClose?: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [form, setForm] = useState<ContactForm>(() => blankContact(propertyId));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const contactsEndpoint = propertyId
    ? `/api/whatsapp/contacts?context=property&propertyId=${encodeURIComponent(propertyId)}`
    : "/api/whatsapp/contacts";

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(contactsEndpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load contacts.");
      setContacts(data.contacts || []);
      setProperties(data.properties || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load contacts.");
    } finally {
      setLoading(false);
    }
  }, [contactsEndpoint]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setForm(blankContact(propertyId));
    setQuery("");
  }, [propertyId]);
  useEffect(() => {
    if (!initialContactId) return;
    const selected = contacts.find(contact => contact.id === initialContactId);
    if (selected) setForm(toForm(selected, propertyId));
  }, [contacts, initialContactId, propertyId]);

  const visibleContacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contacts.filter(contact => {
      if (propertyId && contact.property_id !== propertyId) return false;
      if (!needle) return true;
      return `${contact.contact_name || ""} ${contact.profile_name || ""} ${contact.phone || ""} ${contact.job_position || ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [contacts, propertyId, query]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(contactsEndpoint, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, property_id: propertyId || form.property_id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save contact.");
      await load();
      await onChanged?.();
      setForm(current => ({ ...current, id: data.id || current.id }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!master || !form.id || !window.confirm("Permanently delete this contact and all linked conversations?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/whatsapp/contacts?id=${encodeURIComponent(form.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete contact.");
      setForm(blankContact(propertyId));
      await load();
      await onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete contact.");
    } finally {
      setSaving(false);
    }
  }

  const manager = <section className={`contact-manager ${variant}`}>
    <header>
      <div>
        <small>{propertyId ? "PROPERTY CONTACTS" : "WHATSAPP DIRECTORY"}</small>
        <h2>{propertyId ? propertyName || "Contacts" : "Manage contacts"}</h2>
        <p>{propertyId ? "Phone and WhatsApp contacts linked to this property." : "Add and maintain the shared client contact directory."}</p>
      </div>
      {variant === "modal" && <button type="button" aria-label="Close contacts" onClick={onClose}>×</button>}
    </header>

    <div className="contact-manager-layout">
      <aside>
        <div className="contact-list-tools">
          <button type="button" onClick={() => setForm(blankContact(propertyId))}>＋ Add contact</button>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search contacts" aria-label="Search contacts" />
        </div>
        <div className="contact-list">
          {loading && <p>Loading contacts…</p>}
          {!loading && visibleContacts.length === 0 && <p>No contacts added yet.</p>}
          {visibleContacts.map(contact => <button
            type="button"
            className={form.id === contact.id ? "active" : ""}
            onClick={() => setForm(toForm(contact, propertyId))}
            key={contact.id}
          >
            <span>{(contact.contact_name || contact.profile_name || contact.phone || "C").slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{contact.contact_name || contact.profile_name || contact.phone}</strong>
              <small>{contact.job_position || contact.property_name || "Contact"} · {contact.phone}</small>
            </div>
            <em>{contact.is_active === false ? "Inactive" : "Active"}</em>
          </button>)}
        </div>
      </aside>

      <form onSubmit={save}>
        <div className="contact-form-heading">
          <div>
            <small>{form.id ? "EDIT CONTACT" : "NEW CONTACT"}</small>
            <h3>{form.id ? form.contact_name || form.phone : "Add contact"}</h3>
          </div>
          {form.id && <button type="button" onClick={() => setForm(blankContact(propertyId))}>＋ New</button>}
        </div>
        <div className="contact-form-grid">
          <label>Title<select value={form.name_prefix} onChange={event => setForm({ ...form, name_prefix: event.target.value })}><option value="">None</option><option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option></select></label>
          <label>Contact name<input value={form.contact_name} onChange={event => setForm({ ...form, contact_name: event.target.value })} required /></label>
          <label>Phone / WhatsApp<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+94771234567" inputMode="tel" required /></label>
          <label>Position<input value={form.job_position} onChange={event => setForm({ ...form, job_position: event.target.value })} placeholder="Owner, Manager…" /></label>
          <label className="wide">Property<select value={propertyId || form.property_id} disabled={Boolean(propertyId)} onChange={event => setForm({ ...form, property_id: event.target.value })}><option value="">Unlinked contact</option>{properties.map(property => <option value={property.id} key={property.id}>{property.client_code} · {property.property_name}</option>)}</select></label>
          <label className="wide">Notes<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Preferred contact times or operational notes" /></label>
          <label className="contact-active"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} /> Active contact</label>
        </div>
        {error && <div className="workspace-error">{error}</div>}
        <footer>
          {master && form.id ? <button type="button" className="danger-action" disabled={saving} onClick={remove}>Delete contact</button> : <span />}
          <span />
          {variant === "modal" && <button type="button" onClick={onClose}>Close</button>}
          <button type="submit" className="primary-action" disabled={saving}>{saving ? "Saving…" : form.id ? "Save changes" : "Add contact"}</button>
        </footer>
      </form>
    </div>
  </section>;

  return variant === "modal" ? <div className="creator-backdrop">{manager}</div> : manager;
}
