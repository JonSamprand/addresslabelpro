import { LabelWizard } from "@/components/organisms/LabelWizard";
import { AuthHeader } from "@/components/molecules/AuthHeader";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">AddressLabelPro</h1>
            <p className="text-xs text-gray-500">Intelligent label printing</p>
          </div>
          <AuthHeader />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <LabelWizard />
      </div>
    </main>
  );
}
