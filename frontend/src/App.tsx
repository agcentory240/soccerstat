import { Layout } from './components/Layout/Layout';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MatchesPage } from './pages/MatchesPage/MatchesPage';
import { MatchDetails } from './components/MatchDetails/MatchDetails';
import { MatchDetailsPlaceholder } from './components/MatchDetails/MatchDetailsPlaceholder';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/prognoses" replace />} />
          <Route path="/prognoses" element={<MatchesPage />}>
            <Route index element={<MatchDetailsPlaceholder />} />
            <Route path=":id" element={<MatchDetails />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;