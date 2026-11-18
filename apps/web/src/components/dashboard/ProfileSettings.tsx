'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Trash2, X } from 'lucide-react';
import { apiRequest, errorMessage } from '@/lib/client/api';
import { ensureCsrfToken } from '@/lib/client/csrf';
import { MAX_AVATAR_MB, MAX_AVATAR_BYTES } from '@/lib/profile/avatar';
import styles from './ProfileSettings.module.css';

type Props = {
  name: string | null;
  email: string;
  initials: string;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export function ProfileSettings({ name, email, initials, avatarUrl: serverAvatarUrl, emailVerified }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  const [displayName, setDisplayName] = useState(name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(serverAvatarUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const clearPreview = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPreview(null);
  };

  const upload = async (file: File) => {
    setAvatarError(null);
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_AVATAR_MB} MB.`);
      return;
    }
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      setAvatarError('Use a PNG, JPEG or WebP image.');
      return;
    }

    clearPreview();
    const localUrl = URL.createObjectURL(file);
    objectUrl.current = localUrl;
    setPreview(localUrl);

    const csrf = await ensureCsrfToken();
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setProgress(0);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/v1/profile/avatar');
      xhr.withCredentials = true;
      xhr.setRequestHeader('accept', 'application/json');
      if (csrf) xhr.setRequestHeader('x-csrf-token', csrf);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        setProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.onload = () => {
        const payload = (() => {
          try {
            return JSON.parse(xhr.responseText) as { data?: { avatarUrl?: string | null }; error?: { message?: string } };
          } catch {
            return null;
          }
        })();
        if (xhr.status >= 200 && xhr.status < 300) {
          setAvatarUrl(payload?.data?.avatarUrl ?? null);
          clearPreview();
          router.refresh();
        } else {
          setAvatarError(payload?.error?.message ?? 'The image could not be saved.');
          clearPreview();
        }
        resolve();
      };

      xhr.onerror = () => {
        setAvatarError('The connection dropped while uploading. Try again.');
        clearPreview();
        resolve();
      };

      xhr.send(formData);
    });

    setUploading(false);
    setProgress(0);
  };

  const removeAvatar = async () => {
    setAvatarError(null);
    setUploading(true);
    try {
      await apiRequest('/api/v1/profile/avatar', { method: 'DELETE' });
      setAvatarUrl(null);
      router.refresh();
    } catch (caught) {
      setAvatarError(errorMessage(caught));
    } finally {
      setUploading(false);
    }
  };

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setNameError(null);
    setSaving(true);
    try {
      const result = await apiRequest<{ name: string | null }>('/api/v1/profile', {
        method: 'PATCH',
        body: { name: displayName.trim() },
      });
      setDisplayName(result.name ?? '');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
      router.refresh();
    } catch (caught) {
      setNameError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const shown = preview ?? avatarUrl;

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <p className={styles.cardKicker}>01 / Portrait</p>
            <h2 className={styles.cardTitle}>Your picture</h2>
          </div>
          <span className={styles.cardMeta}>{MAX_AVATAR_MB} MB max</span>
        </div>

        <div className={styles.avatarRow}>
          <div className={`${styles.avatarFrame} ${uploading ? styles.avatarBusy : ''}`}>
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="" className={styles.avatarImage} />
            ) : (
              <span className={styles.avatarInitials}>{initials || 'U'}</span>
            )}
            {uploading ? (
              <span className={styles.avatarProgress} aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </span>
            ) : null}
          </div>

          <div className={styles.avatarCopy}>
            <p className={styles.avatarLead}>Square images look best. PNG, JPEG or WebP.</p>
            <div className={styles.avatarActions}>
              <button type="button" className={styles.secondary} onClick={() => inputRef.current?.click()} disabled={uploading}>
                <Camera size={13} /> {shown ? 'Replace' : 'Upload'}
              </button>
              {shown ? (
                <button type="button" className={styles.ghostDanger} onClick={removeAvatar} disabled={uploading}>
                  <Trash2 size={12} /> Remove
                </button>
              ) : null}
            </div>
            {avatarError ? (
              <p className={styles.error}>
                <X size={11} /> {avatarError}
              </p>
            ) : null}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={styles.input}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void upload(file);
            }}
          />
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <p className={styles.cardKicker}>02 / Identity</p>
            <h2 className={styles.cardTitle}>How you appear</h2>
          </div>
          <span className={`${styles.pill} ${emailVerified ? styles.pillGood : styles.pillWarn}`}>
            {emailVerified ? 'Verified' : 'Unverified'}
          </span>
        </div>

        <form className={styles.form} onSubmit={saveName}>
          <label className={styles.field}>
            <span className={styles.label}>Display name</span>
            <input
              className={styles.inputField}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              maxLength={80}
              autoComplete="name"
            />
          </label>

          <label className={`${styles.field} ${styles.fieldReadonly}`}>
            <span className={styles.label}>Email</span>
            <input className={styles.inputField} value={email} readOnly aria-readonly="true" />
            <span className={styles.fieldHint}>Used for sign-in. Contact support to change it.</span>
          </label>

          <div className={styles.formFoot}>
            <button type="submit" className={styles.primary} disabled={saving || displayName.trim().length === 0}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved ? (
              <span className={styles.saved}>
                <Check size={12} /> Saved
              </span>
            ) : null}
            {nameError ? <span className={styles.error}>{nameError}</span> : null}
          </div>
        </form>
      </section>
    </div>
  );
}
