import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadRemote, registerRemotes } from '@module-federation/runtime';

import {
  REACT_APP_PLANE_EMBED,
  REACT_APP_PLANE_MF_MODULE,
  REACT_APP_PLANE_WEB_URL,
} from '~/config';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import {
  ensureKonnecctModuleFederationHost,
  KONNECCT_PLANE_REMOTE_NAME,
} from '@/projects/utils/konnecctModuleFederationHost';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

/** Browser URL prefix (Twenty shell). */
const USER_PROJECTS_PREFIX = '/projects';
/**
 * Same-origin mount for Plane behind nginx (stripped to proxy root).
 * Must match nginx `location /_konnecct/plane/` and the Plane web bundle public path.
 */
const INTERNAL_PLANE_PATH = '/_konnecct/plane';

const MF_SESSION_FAIL = 'konnecct.plane.mf.failed.v1';

const StyledShell = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  height: 100%;
  background: ${themeCssVariables.background.primary};
`;

const StyledIframe = styled.iframe`
  border: none;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
`;

const StyledPlaceholder = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: ${themeCssVariables.spacing[6]};
  color: ${themeCssVariables.font.color.tertiary};
  text-align: center;
`;

const suffixFromUserProjectsPath = (pathname: string): string => {
  if (pathname === USER_PROJECTS_PREFIX) {
    return '/';
  }
  if (pathname.startsWith(`${USER_PROJECTS_PREFIX}/`)) {
    return pathname.slice(USER_PROJECTS_PREFIX.length);
  }
  return '/';
};

const userPathFromPlanePathname = (
  iframePathname: string,
  planeMountPath: string,
): string | null => {
  const mount = planeMountPath.endsWith('/')
    ? planeMountPath.slice(0, -1)
    : planeMountPath;
  if (!iframePathname.startsWith(mount === '' ? '/' : mount)) {
    return null;
  }
  const rest =
    mount === ''
      ? iframePathname
      : iframePathname.slice(mount.length) || '/';
  const norm = rest === '' ? '/' : rest.startsWith('/') ? rest : `/${rest}`;
  if (norm === '/') {
    return USER_PROJECTS_PREFIX;
  }
  return `${USER_PROJECTS_PREFIX}${norm}`;
};

type PlaneMountResolution = {
  iframeBase: string;
  syncPathPrefix: string | null;
};

const resolvePlaneMount = (
  explicitTrimmed: string,
  isLocalhost: boolean,
): PlaneMountResolution | null => {
  if (explicitTrimmed) {
    try {
      const u = new URL(explicitTrimmed, window.location.origin);
      const mount =
        u.pathname.replace(/\/$/, '') === '' ? '' : u.pathname.replace(/\/$/, '');
      const iframeBase = `${u.origin}${mount}`;
      const syncPathPrefix =
        u.origin === window.location.origin ? mount || '' : null;
      return { iframeBase, syncPathPrefix };
    } catch {
      return null;
    }
  }
  if (!isLocalhost) {
    return {
      iframeBase: `${window.location.origin}${INTERNAL_PLANE_PATH}`,
      syncPathPrefix: INTERNAL_PLANE_PATH,
    };
  }
  return null;
};

type FederatedPlaneProps = Record<string, unknown>;

/**
 * Konnecct Projects: prefers Module Federation (true single-document micro-frontend)
 * when Plane ships `remoteEntry.js` exposing `REACT_APP_PLANE_MF_MODULE`.
 *
 * Plane fork (apps/web): `app/konnecct-shell.tsx` + `entry.client` MF mount hook are in place.
 * `@module-federation/vite` currently rewrites the React Router SSR graph and breaks SPA
 * `index.html` pre-render; ship `remoteEntry.js` via a client-only MF pipeline or upstream fix,
 * exposing `./KonnecctShell` with shared `react` / `react-dom` singletons to match this host.
 *
 * Embed modes (REACT_APP_PLANE_EMBED):
 * - `auto` — try federation once per session, then iframe (default).
 * - `federation` — federation only; shows an error if the remote is missing.
 * - `iframe` — legacy nested document only.
 */
export const KonnecctProjectsEmbed = () => {
  const { t } = useLingui();
  const location = useLocation();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const workspaceSlug = currentWorkspace?.subdomain ?? '';

  const explicit = REACT_APP_PLANE_WEB_URL.trim().replace(/\/$/, '');
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const resolved = useMemo(
    () => resolvePlaneMount(explicit, isLocalhost),
    [explicit, isLocalhost],
  );

  const embedMode = REACT_APP_PLANE_EMBED;
  const mfModuleId =
    REACT_APP_PLANE_MF_MODULE.trim() ||
    `${KONNECCT_PLANE_REMOTE_NAME}/./KonnecctShell`;
  const mfModuleIdFallback =
    mfModuleId === `${KONNECCT_PLANE_REMOTE_NAME}/./KonnecctShell`
      ? `${KONNECCT_PLANE_REMOTE_NAME}/KonnecctShell`
      : '';

  const remoteEntryUrl = resolved
    ? `${resolved.iframeBase.replace(/\/$/, '')}/remoteEntry.js`
    : '';

  const iframeSrc = useMemo(() => {
    if (resolved === null || !workspaceSlug) {
      return '';
    }
    const suffix = suffixFromUserProjectsPath(location.pathname);
    const underWorkspace =
      suffix === '/' ? `/${workspaceSlug}/` : `/${workspaceSlug}${suffix}`;
    return `${resolved.iframeBase.replace(/\/$/, '')}${underWorkspace}`;
  }, [resolved, workspaceSlug, location.pathname]);

  const pathSuffix = suffixFromUserProjectsPath(location.pathname);
  const planePathSuffix =
    workspaceSlug !== ''
      ? pathSuffix === '/'
        ? `/${workspaceSlug}/`
        : `/${workspaceSlug}${pathSuffix}`
      : '/';

  useEffect(() => {
    // Plane's "Visit Profile" can navigate to /projects/profile which is not part
    // of the unified Konnecct Projects surface. Keep users in the CRM profile.
    if (location.pathname === '/projects/profile') {
      navigate('/settings/profile', { replace: true });
    }
  }, [location.pathname, navigate]);

  const planePathSyncPrefix =
    workspaceSlug !== '' ? `${INTERNAL_PLANE_PATH}/${workspaceSlug}` : null;

  const [federated, setFederated] = useState<ComponentType<FederatedPlaneProps> | null>(
    null,
  );
  const [federationFailed, setFederationFailed] = useState(false);
  const [federationError, setFederationError] = useState<string | null>(null);

  const mfBlockedBySession =
    embedMode === 'auto' &&
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem(MF_SESSION_FAIL) === '1';

  const showIframe =
    embedMode === 'iframe' ||
    mfBlockedBySession ||
    (embedMode === 'auto' && federationFailed);

  const showFederated =
    Boolean(federated) && embedMode !== 'iframe' && !mfBlockedBySession;

  const tryFederation =
    embedMode !== 'iframe' && resolved && !mfBlockedBySession;

  useEffect(() => {
    if (!tryFederation || federated || !remoteEntryUrl) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        ensureKonnecctModuleFederationHost();
        registerRemotes(
          [
            {
              name: KONNECCT_PLANE_REMOTE_NAME,
              entry: remoteEntryUrl,
              type: 'module',
            },
          ],
          { force: true },
        );
        let mod:
          | ComponentType<FederatedPlaneProps>
          | { default: ComponentType<FederatedPlaneProps> }
          | null = null;

        try {
          mod = await loadRemote<
            | ComponentType<FederatedPlaneProps>
            | { default: ComponentType<FederatedPlaneProps> }
          >(mfModuleId);
        } catch (primaryError) {
          if (!mfModuleIdFallback) {
            throw primaryError;
          }
          mod = await loadRemote<
            | ComponentType<FederatedPlaneProps>
            | { default: ComponentType<FederatedPlaneProps> }
          >(mfModuleIdFallback);
        }
        if (cancelled) {
          return;
        }
        if (!mod) {
          throw new Error('Remote module empty');
        }
        const Comp =
          typeof mod === 'function'
            ? mod
            : (mod as { default: ComponentType<FederatedPlaneProps> }).default;
        if (!Comp) {
          throw new Error('Remote has no default export');
        }
        setFederated(() => Comp);
        setFederationFailed(false);
        setFederationError(null);
      } catch (e) {
        if (cancelled) {
          return;
        }
        if (embedMode === 'federation') {
          setFederationError(e instanceof Error ? e.message : String(e));
          setFederationFailed(true);
        } else {
          setFederationFailed(true);
          try {
            sessionStorage.setItem(MF_SESSION_FAIL, '1');
          } catch {
            /* private mode */
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    tryFederation,
    federated,
    remoteEntryUrl,
    mfModuleId,
    mfModuleIdFallback,
    embedMode,
  ]);

  useEffect(() => {
    if (planePathSyncPrefix === null || !showIframe) {
      return;
    }

    const id = window.setInterval(() => {
      const el = iframeRef.current;
      const win = el?.contentWindow;
      if (!win) {
        return;
      }
      try {
        const iframePath = win.location.pathname;
        const target = userPathFromPlanePathname(iframePath, planePathSyncPrefix);
        if (target !== null && target !== location.pathname) {
          navigate(target, { replace: true });
        }
      } catch {
        /* cross-origin */
      }
    }, 400);

    return () => window.clearInterval(id);
  }, [planePathSyncPrefix, location.pathname, navigate, showIframe]);

  if (!resolved) {
    return (
      <StyledShell>
        <StyledPlaceholder>
          {t`Set REACT_APP_PLANE_WEB_URL to your Plane web URL (required on localhost). In production, Plane is loaded from /_konnecct/plane when this is unset.`}
        </StyledPlaceholder>
      </StyledShell>
    );
  }

  if (!workspaceSlug) {
    return (
      <StyledShell>
        <StyledPlaceholder>
          {t`Konnecct Projects needs a workspace subdomain. Open Settings or complete workspace setup.`}
        </StyledPlaceholder>
      </StyledShell>
    );
  }

  if (embedMode === 'federation') {
    if (federationError && !federated) {
      return (
        <StyledShell>
          <StyledPlaceholder>
            {t`Konnecct Projects could not load the unified Plane module (${federationError}). Build Plane with Module Federation (remoteEntry.js) or use REACT_APP_PLANE_EMBED=auto.`}
          </StyledPlaceholder>
        </StyledShell>
      );
    }
    if (showFederated) {
      const Remote = federated as ComponentType<FederatedPlaneProps>;
      return (
        <StyledShell>
          <Suspense
            fallback={
              <StyledPlaceholder>{t`Loading Konnecct Projects…`}</StyledPlaceholder>
            }
          >
            <Remote
              konnecctPathSuffix={planePathSuffix}
              konnecctPlaneBasename={INTERNAL_PLANE_PATH}
            />
          </Suspense>
        </StyledShell>
      );
    }
    return (
      <StyledShell>
        <StyledPlaceholder>{t`Loading Konnecct Projects…`}</StyledPlaceholder>
      </StyledShell>
    );
  }

  if (showFederated) {
    const Remote = federated as ComponentType<FederatedPlaneProps>;
    return (
      <StyledShell>
        <Suspense
          fallback={
            <StyledPlaceholder>{t`Loading Konnecct Projects…`}</StyledPlaceholder>
          }
        >
          <Remote
            konnecctPathSuffix={planePathSuffix}
            konnecctPlaneBasename={INTERNAL_PLANE_PATH}
          />
        </Suspense>
      </StyledShell>
    );
  }

  if (!showIframe) {
    return (
      <StyledShell>
        <StyledPlaceholder>{t`Loading Konnecct Projects…`}</StyledPlaceholder>
      </StyledShell>
    );
  }

  return (
    <StyledShell>
      <StyledIframe
        ref={iframeRef}
        title={t`Konnecct Projects`}
        src={iframeSrc}
        allow="camera *; microphone *; display-capture *; fullscreen *"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-top-navigation-by-user-activation"
      />
    </StyledShell>
  );
};
