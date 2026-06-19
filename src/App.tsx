import { BrowserRouter, Routes, Route } from "react-router-dom";
import LessonsPage from "@/pages/LessonsPage";
import LessonDetailPage from "@/pages/LessonDetailPage";
import BoardPage from "@/pages/BoardPage";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
            <a href="/" className="text-xl font-bold tracking-tight">
              Chess Study
            </a>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<LessonsPage />} />
            <Route path="/lesson/:id" element={<LessonDetailPage />} />
            <Route path="/lesson/:id/board/:boardId" element={<BoardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
