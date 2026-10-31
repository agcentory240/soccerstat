import { Layout } from './components/Layout/Layout';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MatchesPage } from './pages/MatchesPage/MatchesPage';
import { MatchDetails } from './components/MatchDetails/MatchDetails';
import { MatchDetailsPlaceholder } from './components/MatchDetails/MatchDetailsPlaceholder';
import { MainPage } from './pages/MainPage';
import { TopPage } from './pages/TopPage/TopPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MainPage/>} />
          <Route path="/top" element={<TopPage/>} />
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