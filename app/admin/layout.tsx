import { Nav } from '@/app/components/Nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <Nav />
      {children}
    </div>
  );
}
