import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/app/theme";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/components/layout/AppShell";
import { CategoryPage } from "@/components/layout/CategoryPage";
import { DownloadPage } from "@/components/layout/DownloadPage";
import { HomePage } from "@/components/layout/HomePage";
import { NotFoundPage } from "@/components/layout/NotFoundPage";
import { ToolPage } from "@/components/layout/ToolPage";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="tools/:toolId" element={<ToolPage />} />
              <Route path="categories/:categoryId" element={<CategoryPage />} />
              <Route path="download" element={<DownloadPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
