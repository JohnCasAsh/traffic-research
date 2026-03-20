import { RouterProvider } from 'react-router';
import { AuthProvider } from './auth';
import { LocationConsentProvider } from './LocationConsentContext';
import { router } from './routes';

function App() {
  return (
    <AuthProvider>
      <LocationConsentProvider>
        <RouterProvider router={router} />
      </LocationConsentProvider>
    </AuthProvider>
  );
}

export default App;
