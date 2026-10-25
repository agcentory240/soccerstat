import { Layout } from './components/Layout/Layout';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MatchesPage } from './pages/MatchesPage/MatchesPage';
import { MatchDetails } from './components/MatchDetails/MatchDetails';
import { MatchDetailsPlaceholder } from './components/MatchDetails/MatchDetailsPlaceholder';
import { MainPage } from './pages/MainPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MainPage/>} />
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