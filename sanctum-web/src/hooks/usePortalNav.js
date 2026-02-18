import { useNavigate, useSearchParams } from 'react-router-dom';

export default function usePortalNav() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const impersonateId = searchParams.get('impersonate');

  const portalNav = (path) => {
    const separator = path.includes('?') ? '&' : '?';
    const url = impersonateId ? `${path}${separator}impersonate=${impersonateId}` : path;
    navigate(url);
  };

  return { portalNav, impersonateId };
}