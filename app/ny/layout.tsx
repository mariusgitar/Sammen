import { Nav } from '@/app/components/Nav';

export default function NewSessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
