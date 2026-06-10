"use client";

import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { CheckCircle2, Circle } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { SocialMediaEditor } from "@/components/builder/SocialMediaEditor";
import { MassTimesForm } from "@/components/mass-times/MassTimesForm";
import { DonationsManager } from "@/components/donations/DonationsManager";
import { MediaPicker } from "@/components/media/MediaPicker";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS, SITE_CONFIG_ID } from "@/lib/firestore/paths";
import { formatBytes, uploadMediaFile } from "@/lib/media/upload";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { normalizeMassTimes } from "@/lib/mass-times/schema";
import { sanitizeSocialMediaConfig } from "@/lib/site/social-media";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

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
    const next = partial.seo
      ? { ...config, seo: { ...(config.seo || {}), ...partial.seo } }
      : { ...config, ...partial };
    const firestorePatch = partial.seo
      ? { seo: next.seo, updatedAt: new Date().toISOString() }
      : { ...partial, updatedAt: new Date().toISOString() };
    setConfig(next);
    await updateDoc(doc(db, COLLECTIONS.site, SITE_CONFIG_ID), firestorePatch);
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "settings", label: "Settings" },
    { id: "donations", label: "Donations" },
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
            <SearchAppearanceEditor
              seo={config.seo || {}}
              onSave={(seoPatch) => saveConfig({ seo: seoPatch })}
            />
            <Card className="p-4">
              <SocialMediaEditor
                value={config.socialMedia}
                onChange={(socialMedia) => {
                  setConfig((prev) => ({ ...prev, socialMedia }));
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  saveConfig({ socialMedia: sanitizeSocialMediaConfig(config.socialMedia) })
                }
              >
                Save social media
              </Button>
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
                <li>
                  Deploy to <strong>Vercel</strong> or <strong>Firebase App Hosting</strong> and add
                  your domain in the host&apos;s settings.
                </li>
                <li>Point DNS A/CNAME records per your host&apos;s instructions.</li>
                <li>
                  Set <code>NEXT_PUBLIC_SITE_URL</code> and <code>NEXT_PUBLIC_APP_URL</code> to your
                  canonical domain.
                </li>
                <li>Configure Stripe webhook to <code>/api/stripe/webhook</code>.</li>
                <li>Add your domain to Firebase Auth → Authorized domains.</li>
              </ol>
            </Section>
          </div>
        )}

        {tab === "donations" && <DonationsManager />}

        {tab === "users" && <UsersAdmin users={users} />}

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

function SearchAppearanceEditor({ seo, onSave }) {
  const [description, setDescription] = useState(seo.description || "");
  const [faviconUrl, setFaviconUrl] = useState(seo.faviconUrl || "");
  const [pickingFavicon, setPickingFavicon] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const uploadRef = useRef(null);

  useEffect(() => {
    setDescription(seo.description || "");
    setFaviconUrl(seo.faviconUrl || "");
  }, [seo.description, seo.faviconUrl]);

  const saveDescription = (value) => {
    onSave({ description: value.trim() });
  };

  const saveFavicon = (url) => {
    setFaviconUrl(url);
    onSave({ faviconUrl: url });
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const db = getFirebaseFirestore();
      const record = await uploadMediaFile(
        db,
        file,
        DEFAULT_MEDIA_FOLDERS.pictures,
        setProgress,
      );
      saveFavicon(record.downloadUrl || "");
    } finally {
      setUploading(false);
      setProgress(0);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  if (pickingFavicon) {
    return (
      <Card className="p-4">
        <div className="flex min-h-[320px] flex-col">
          <MediaPicker
            title="Choose favicon"
            onSelect={(file) => {
              saveFavicon(file.downloadUrl || "");
              setPickingFavicon(false);
            }}
            onCancel={() => setPickingFavicon(false)}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="font-medium text-foreground">Search appearance</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Site-wide defaults for search engines and browser tabs.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="default-meta-description">Default meta description</Label>
        <textarea
          id="default-meta-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => saveDescription(description)}
          rows={3}
          placeholder="Brief description of your parish for search results"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <p className="text-xs text-muted-foreground">
          Used when a page does not have its own meta description.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Favicon</Label>
        <p className="text-xs text-muted-foreground">
          Square image shown in browser tabs. PNG, ICO, or SVG recommended.
        </p>
        {faviconUrl && (
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded border border-border">
              <Image
                src={faviconUrl}
                alt="Site favicon"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => saveFavicon("")}>
              Remove
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPickingFavicon(true)}>
            Browse media
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => uploadRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? `Uploading ${progress}%` : "Upload image"}
          </Button>
        </div>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*,.ico,.svg"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </Card>
  );
}
