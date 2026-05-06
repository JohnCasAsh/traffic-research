import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  Camera,
  House,
  ImagePlus,
  Info,
  KeyRound,
  Mail,
  MapPinned,
  Pencil,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { Link } from 'react-router';
import { API_URL, buildAuthHeaders } from '../api';
import { createEmptyAddress, useAuth, type UserAddress } from '../auth';
import { AssistantPanel } from './AssistantPanel';

type Notice = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type ProfileFormState = {
  firstName: string;
  lastName: string;
  profilePictureUrl: string;
  address: UserAddress;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unable to read selected image.'));
    };
    reader.onerror = () => reject(new Error('Unable to read selected image.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to open selected image.'));
    image.src = source;
  });
}

async function createProfilePictureDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Select an image file.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MB.');
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  const size = 256;

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to prepare selected image.');
  }

  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (size - width) / 2;
  const y = (size - height) / 2;

  context.fillStyle = '#e2e8f0';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, x, y, width, height);

  return canvas.toDataURL('image/jpeg', 0.82);
}

function createProfileFormState(user: ReturnType<typeof useAuth>['user']): ProfileFormState {
  return {
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    profilePictureUrl: user?.profilePictureUrl || '',
    address: user?.address || createEmptyAddress(),
  };
}

function formatProviderName(provider: string) {
  if (provider === 'google') {
    return 'Google';
  }

  if (provider === 'github') {
    return 'GitHub';
  }

  return provider;
}

export function ProfilePage() {
  const { logout, token, updateUser, user } = useAuth();
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setChatLoading(true);
    fetch(`${API_URL}/api/auth/chat-token`, { headers: buildAuthHeaders(token) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setChatUrl(data.url))
      .catch(() => setChatUrl(null))
      .finally(() => setChatLoading(false));
  }, [token]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => createProfileFormState(user));
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileNotice, setProfileNotice] = useState<Notice | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  const baseProfileForm = useMemo(() => createProfileFormState(user), [user]);

  useEffect(() => {
    setProfileForm(baseProfileForm);
    setIsEditingProfile(false);
  }, [baseProfileForm]);

  const profileInitials = useMemo(() => {
    const firstInitial = (profileForm.firstName || user?.firstName || 'U').charAt(0).toUpperCase();
    const lastInitial = (profileForm.lastName || user?.lastName || '').charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`.trim() || 'U';
  }, [profileForm.firstName, profileForm.lastName, user?.firstName, user?.lastName]);

  const providerList = useMemo(() => {
    if (!user) {
      return [];
    }

    const providers = user.authProviders.length > 0 ? user.authProviders : user.hasPassword ? ['password'] : [];
    return providers.map((provider) => formatProviderName(provider));
  }, [user]);

  const canChangePassword = Boolean(user?.hasPassword);

  const hasUnsavedProfileChanges = useMemo(() => {
    return JSON.stringify(profileForm) !== JSON.stringify(baseProfileForm);
  }, [baseProfileForm, profileForm]);

  const setAddressField = (field: keyof UserAddress, value: string) => {
    if (!isEditingProfile) {
      return;
    }

    setProfileForm((current) => ({
      ...current,
      address: {
        ...current.address,
        [field]: value,
      },
    }));
  };

  const handleStartEditingProfile = () => {
    setProfileNotice(null);
    setIsEditingProfile(true);
  };

  const handleCancelEditingProfile = () => {
    setProfileForm(baseProfileForm);
    setProfileNotice({ type: 'info', text: 'Profile changes were discarded.' });
    setIsEditingProfile(false);
  };

  const handlePictureUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isEditingProfile) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingPicture(true);
    setProfileNotice(null);

    try {
      const pictureDataUrl = await createProfilePictureDataUrl(file);
      setProfileForm((current) => ({
        ...current,
        profilePictureUrl: pictureDataUrl,
      }));
      setProfileNotice({
        type: 'info',
        text: 'Picture ready. Save your profile to keep it.',
      });
    } catch (error) {
      setProfileNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to prepare selected picture.',
      });
    } finally {
      if (event.target) {
        event.target.value = '';
      }
      setIsUploadingPicture(false);
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isEditingProfile) {
      setProfileNotice({ type: 'info', text: 'Click Edit Profile first to make changes.' });
      return;
    }

    if (!hasUnsavedProfileChanges) {
      setProfileNotice({ type: 'info', text: 'No changes to save yet.' });
      return;
    }

    if (!token) {
      logout();
      return;
    }

    setIsSavingProfile(true);
    setProfileNotice(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'PATCH',
        headers: buildAuthHeaders(token, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(profileForm),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update profile.');
      }

      if (payload?.user) {
        updateUser(payload.user);
      }

      setProfileNotice({
        type: 'success',
        text: payload?.message || 'Profile updated successfully.',
      });
      setIsEditingProfile(false);
    } catch (error) {
      setProfileNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to update profile.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      logout();
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordNotice(null);

    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: buildAuthHeaders(token, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update password.');
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordNotice({
        type: 'success',
        text: payload?.message || 'Password updated successfully.',
      });
    } catch (error) {
      setPasswordNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to update password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex">
      <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_rgba(13,148,136,0.08),_rgba(59,130,246,0.05)_55%,_rgba(248,250,252,0.95))] px-6 py-8 md:px-8">
            <div className="grid gap-6 lg:grid-cols-[220px,1fr] lg:items-center">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="relative mx-auto w-fit">
                  {profileForm.profilePictureUrl ? (
                    <img
                      src={profileForm.profilePictureUrl}
                      alt="Profile"
                      className="h-28 w-28 rounded-[1.5rem] object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-teal-500 to-blue-600 text-3xl font-bold text-white shadow-sm">
                      {profileInitials}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isEditingProfile}
                    className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Upload profile picture"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePictureUpload}
                  className="hidden"
                />

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isEditingProfile || isUploadingPicture}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {isUploadingPicture ? 'Preparing...' : 'Change Picture'}
                  </button>

                  {isEditingProfile && profileForm.profilePictureUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setProfileForm((current) => ({
                          ...current,
                          profilePictureUrl: '',
                        }))
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-lg bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                    Profile
                  </span>
                  <span className="inline-flex rounded-lg border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                    {user?.role || 'driver'}
                  </span>
                </div>

                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  {user?.firstName || 'Your'} account profile
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                  Manage your personal details, address information, and account security from one place. Google and GitHub accounts can update first and last name here as well.
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                  <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{user?.email || 'No email available'}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                    <span>
                      {providerList.length > 0
                        ? providerList.map((provider) =>
                            provider === 'password' ? 'Email & Password' : provider
                          ).join(', ')
                        : 'Standard account'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <HeroMetaCard
                    title="Full Name"
                    value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Not set'}
                  />
                  <HeroMetaCard title="Province" value={user?.address.province || 'Not set'} />
                  <HeroMetaCard title="Barangay" value={user?.address.barangay || 'Not set'} />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onSubmit={handleSaveProfile}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Account Details</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Personal information stays read-only until Edit Profile is enabled.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleStartEditingProfile}
                  disabled={isEditingProfile}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </button>

                {isEditingProfile && (
                  <button
                    type="button"
                    onClick={handleCancelEditingProfile}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!isEditingProfile || !hasUnsavedProfileChanges || isSavingProfile}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-teal-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Save className="h-4 w-4" />
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {isEditingProfile ? 'Editing mode is enabled' : 'Read-only mode is active'}
            </p>

            {profileNotice && (
              <div
                className={`mt-5 rounded-lg border px-4 py-3 text-sm ${
                  profileNotice.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : profileNotice.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {profileNotice.text}
              </div>
            )}

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <LabeledField label="First Name" icon={<UserRound className="h-4 w-4" />}>
                <input
                  value={profileForm.firstName}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  readOnly={!isEditingProfile}
                  className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none transition ${
                    isEditingProfile
                      ? 'border-slate-200 bg-white text-slate-900 focus:border-teal-500'
                      : 'border-slate-200 bg-slate-100 text-slate-500'
                  }`}
                  placeholder="Enter your first name"
                />
              </LabeledField>

              <LabeledField label="Last Name" icon={<UserRound className="h-4 w-4" />}>
                <input
                  value={profileForm.lastName}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  readOnly={!isEditingProfile}
                  className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none transition ${
                    isEditingProfile
                      ? 'border-slate-200 bg-white text-slate-900 focus:border-teal-500'
                      : 'border-slate-200 bg-slate-100 text-slate-500'
                  }`}
                  placeholder="Enter your last name"
                />
              </LabeledField>

              <LabeledField label="Email Address" icon={<Mail className="h-4 w-4" />}>
                <input
                  value={user?.email || ''}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
                />
              </LabeledField>

              <LabeledField label="Account Type" icon={<ShieldCheck className="h-4 w-4" />}>
                <input
                  value={providerList.length > 0 ? providerList.join(', ') : 'Standard account'}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
                />
              </LabeledField>
            </div>

            <div className="mt-9 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm border border-slate-200">
                  <House className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Address Details</h3>
                  <p className="text-sm text-slate-600">
                    Complete location from country down to house number.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <AddressInput
                  label="Country"
                  value={profileForm.address.country}
                  placeholder="Philippines"
                  disabled={!isEditingProfile}
                  onChange={(value) => setAddressField('country', value)}
                />
                <AddressInput
                  label="Province / State"
                  value={profileForm.address.province}
                  placeholder="Bulacan"
                  disabled={!isEditingProfile}
                  onChange={(value) => setAddressField('province', value)}
                />
                <AddressInput
                  label="City / Municipality"
                  value={profileForm.address.city}
                  placeholder="Malolos"
                  disabled={!isEditingProfile}
                  onChange={(value) => setAddressField('city', value)}
                />
                <AddressInput
                  label="Barangay"
                  value={profileForm.address.barangay}
                  placeholder="Santo Rosario"
                  disabled={!isEditingProfile}
                  onChange={(value) => setAddressField('barangay', value)}
                />
                <AddressInput
                  label="Street"
                  value={profileForm.address.street}
                  placeholder="MacArthur Highway"
                  disabled={!isEditingProfile}
                  onChange={(value) => setAddressField('street', value)}
                />
                <AddressInput
                  label="House Number"
                  value={profileForm.address.houseNumber}
                  placeholder="12-B"
                  disabled={!isEditingProfile}
                  onChange={(value) => setAddressField('houseNumber', value)}
                />
                <div className="md:col-span-2">
                  <AddressInput
                    label="Postal Code"
                    value={profileForm.address.postalCode}
                    placeholder="3000"
                    disabled={!isEditingProfile}
                    onChange={(value) => setAddressField('postalCode', value)}
                  />
                </div>
              </div>
            </div>
          </motion.form>

          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Profile Summary</h2>
                  <p className="text-sm text-slate-500">Snapshot of the details saved in your account.</p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <SummaryRow
                  label="Full Name"
                  value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Not set'}
                />
                <SummaryRow label="Email" value={user?.email || 'Not available'} />
                <SummaryRow label="Country" value={user?.address.country || 'Not set'} />
                <SummaryRow label="Province" value={user?.address.province || 'Not set'} />
                <SummaryRow label="Barangay" value={user?.address.barangay || 'Not set'} />
                <SummaryRow
                  label="Street / House"
                  value={
                    [user?.address.street, user?.address.houseNumber].filter(Boolean).join(', ') ||
                    'Not set'
                  }
                />
              </div>
            </motion.section>

            <motion.form
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onSubmit={handleChangePassword}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Reset Password</h2>
                  <p className="text-sm text-slate-500">
                    Keep your account secure by updating credentials when needed.
                  </p>
                </div>
              </div>

              {passwordNotice && (
                <div
                  className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
                    passwordNotice.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : passwordNotice.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700'
                  }`}
                >
                  {passwordNotice.text}
                </div>
              )}

              {canChangePassword ? (
                <div className="mt-6 space-y-4">
                  <PasswordInput
                    label="Current Password"
                    value={passwordForm.currentPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({
                        ...current,
                        currentPassword: value,
                      }))
                    }
                  />
                  <PasswordInput
                    label="New Password"
                    value={passwordForm.newPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({
                        ...current,
                        newPassword: value,
                      }))
                    }
                  />
                  <PasswordInput
                    label="Confirm New Password"
                    value={passwordForm.confirmPassword}
                    onChange={(value) =>
                      setPasswordForm((current) => ({
                        ...current,
                        confirmPassword: value,
                      }))
                    }
                  />

                  <p className="text-xs leading-5 text-slate-500">
                    Passwords must be 8 to 128 characters and include uppercase, lowercase, and a number.
                  </p>

                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <KeyRound className="h-4 w-4" />
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                  This account was created using {providerList.join(' / ') || 'a social provider'}. Password changes are not available.
                  Please return to sign-in and use the {providerList.join(' / ') || 'social'} sign-in button.
                </div>
              )}
            </motion.form>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Link
                to="/about"
                className="flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm hover:border-teal-300 hover:shadow-md transition-all group"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100 group-hover:bg-teal-100 transition">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-teal-700 transition">About Navocs</h2>
                  <p className="text-sm text-slate-500">Research overview, algorithm, and tech stack</p>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
      </div>
      <AssistantPanel chatUrl={chatUrl} chatLoading={chatLoading} />
    </div>
  );
}

function LabeledField({
  children,
  icon,
  label,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          {icon}
        </span>
        {label}
      </span>
      {children}
    </label>
  );
}

function HeroMetaCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function AddressInput({
  disabled = false,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={disabled}
        placeholder={placeholder}
        className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none transition ${
          disabled
            ? 'border-slate-200 bg-slate-100 text-slate-500'
            : 'border-slate-200 bg-white text-slate-900 focus:border-teal-500'
        }`}
      />
    </label>
  );
}

function PasswordInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-500"
      />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}