import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConnectYouTubeButton } from '@/components/youtube/youtube-connection-panel';
import { fetchApi } from '@/lib/api';
import { formatCount } from '@/lib/youtube';
import type { SocialAccountListItem } from '@sma/types';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const accounts = await fetchApi<{ data: SocialAccountListItem[] }>('/api/social-accounts');
  const rows = accounts.ok ? accounts.data.data : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Account management"
        description="Connected social accounts are listed from SQL Server after a successful OAuth connection."
      />

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-cloud-200 bg-white shadow-panel">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-cloud-50 text-ink-700/70">
              <tr>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Subscribers</th>
                <th className="px-4 py-3 font-medium">Views</th>
                <th className="px-4 py-3 font-medium">Videos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((account) => (
                <tr key={account.id} className="border-t border-cloud-200">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {account.profileImageUrl ? (
                        <img
                          src={account.profileImageUrl}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : null}
                      <div>
                        <p className="font-medium text-ink-900">
                          {account.displayName ?? account.id}
                        </p>
                        {account.username ? (
                          <p className="text-ink-700/70">@{account.username}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{account.platformCode}</td>
                  <td className="px-4 py-3">{account.status}</td>
                  <td className="px-4 py-3">{formatCount(account.subscribersCount)}</td>
                  <td className="px-4 py-3">{formatCount(account.totalViews)}</td>
                  <td className="px-4 py-3">{formatCount(account.totalPosts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No connected accounts"
          titleAr="لا توجد حسابات مربوطة"
          description={
            accounts.ok
              ? 'Connect YouTube to create the first social account record.'
              : 'The accounts API is not reachable yet. No placeholder accounts are shown.'
          }
        />
      )}

      <ConnectYouTubeButton />
    </div>
  );
}
