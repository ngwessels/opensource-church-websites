"use client";

import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { CheckCircle2, Circle } from "lucide-react";
import { useEffect, useState } from "react";

import { MassTimesForm } from "@/components/mass-times/MassTimesForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { formatBytes } from "@/lib/media/upload";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { normalizeMassTimes } from "@/lib/mass-times/schema";

export function AdminPanel({ siteConfig, pageCount = 0 }) {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [config, setConfig] = useState(siteConfig || {});
  const [mediaSize, setMediaSize] = useState(0);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const unsubUsers = onSnapshot(collection(db, COLLECTIONS.users), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubMedia = onSnapshot(collection(db, COLLECTIONS.media), (snap) => {
      setMediaSize(snap.docs.reduce((s, d) => s + (d.data().sizeBytes || 0), 0));
    });
    return () => {
      unsubUsers();
      unsubMedia();
    };
  }, []);

  const saveConfig = async (partial) => {
    const db = getFirebaseFirestore();
    const next = { ...config, ...partial };
    setConfig(next);
    await updateDoc(doc(db, COLLECTIONS.site, SITE_CONFIG_ID), {
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "settings", label: "Settings" },
    { id: "users", label: "Admin Users" },
    { id: "mass", label: "Sacraments & Mass Times" },
  ];

  return (
    <div className="flex h-full flex-col bg-muted">
      <div className="flex border-b border-border bg-card">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-6 py-3 text-sm font-medium ${
              tab === t.id ? "admin-tab-active text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === "overview" && (
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Account</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Open Source Church Websites</p>
                <p>Self-hosted deployment</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Domain</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {config.canonicalDomain || process.env.NEXT_PUBLIC_SITE_URL || "Not set"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pages</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{pageCount}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Storage</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{formatBytes(mediaSize)}</CardContent>
            </Card>
          </div>
        )}

        {tab === "settings" && (
          <div className="mx-auto max-w-2xl space-y-4">
            <Card className="p-4 space-y-4">
              <div>
                <Label htmlFor="siteName">Site name</Label>
                <Input
                  id="siteName"
                  value={config.name || ""}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  onBlur={() => saveConfig({ name: config.name })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={config.tagline || ""}
                  onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                  onBlur={() => saveConfig({ tagline: config.tagline })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="domain">Canonical domain</Label>
                <Input
                  id="domain"
                  value={config.canonicalDomain || ""}
                  onChange={(e) => setConfig({ ...config, canonicalDomain: e.target.value })}
                  onBlur={() => saveConfig({ canonicalDomain: config.canonicalDomain })}
                  placeholder="www.yourparish.org"
                  className="mt-1"
                />
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="mb-3 font-medium text-foreground">Environment checklist</h3>
              <ul className="space-y-2 text-sm">
                <CheckItem done={isFirebaseConfigured()} label="Firebase configured" />
                <CheckItem done={!!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} label="Stripe configured" />
                <CheckItem done={!!config.canonicalDomain} label="Custom domain set" />
              </ul>
            </Card>
            <Section title="Custom domain setup">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Deploy to Vercel and add your domain in project settings.</li>
                <li>Point DNS A/CNAME records per Vercel instructions.</li>
                <li>Set <code>NEXT_PUBLIC_SITE_URL</code> to your canonical domain.</li>
                <li>Configure Stripe webhook to <code>/api/stripe/webhook</code>.</li>
              </ol>
            </Section>
          </div>
        )}

        {tab === "users" && (
          <div className="mx-auto max-w-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Name</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="py-2">{u.email}</td>
                    <td className="py-2 capitalize">{u.role}</td>
                    <td className="py-2">{u.displayName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-muted-foreground">
              New users sign up at /signup. First user becomes admin automatically.
            </p>
          </div>
        )}

        {tab === "mass" && (
          <MassTimesEditor
            massTimes={config.massTimes || {}}
            onSave={(massTimes) => saveConfig({ massTimes })}
          />
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <Card className="p-4">
      <h3 className="mb-2 font-medium text-foreground">{title}</h3>
      {children}
    </Card>
  );
}

function CheckItem({ done, label }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex items-center gap-2 text-foreground">
      <Icon className={`h-4 w-4 ${done ? "text-emerald-600" : "text-muted-foreground/40"}`} />
      {label}
    </li>
  );
}

function MassTimesEditor({ massTimes, onSave }) {
  const [times, setTimes] = useState(() => normalizeMassTimes(massTimes));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <MassTimesForm value={times} onChange={setTimes} />
      <Button onClick={() => onSave(normalizeMassTimes(times))}>
        Save Mass Times
      </Button>
    </div>
  );
}
