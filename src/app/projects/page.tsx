import { PageHeader, PhaseTwoStub } from "@/components/ims";

export default function ProjectsPage() {
  return (
    <main className="min-vh-100 bg-body-tertiary p-4">
      <div className="container-fluid">
        <PageHeader title="Research Project Inventory" subtitle="Research project-linked inventory views are planned in Phase 2." />
        <PhaseTwoStub title="Research Project Inventory" description="Project-linked assets and consumables are planned in Phase 2." />
      </div>
    </main>
  );
}
