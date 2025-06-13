import { useEffect, useState, type FC, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import { useInterval } from 'usehooks-ts';

interface PortalProps extends PropsWithChildren {
  id: string;
}

const Portal: FC<PortalProps> = ({ children, id }) => {
  const [isClient, setIsClient] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const findPortalRoot = () => {
    const element = document.getElementById(id);
    if (element) {
      setPortalRoot(element);
    } else {
      setPortalRoot(null);
    }
  };

  useEffect(() => {
    if (isClient) {
      findPortalRoot();
      window.addEventListener('resize', findPortalRoot);
      return () => {
        window.removeEventListener('resize', findPortalRoot);
      };
    }
  }, [isClient, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useInterval(
    () => {
      if (isClient && !portalRoot) {
        findPortalRoot();
      }
    },
    !portalRoot ? 100 : null
  );

  if (!isClient || !portalRoot) {
    return null;
  }

  return createPortal(children, portalRoot);
};

export default Portal;
