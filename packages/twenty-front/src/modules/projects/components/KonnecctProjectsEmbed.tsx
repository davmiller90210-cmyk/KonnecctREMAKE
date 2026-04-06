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

import {
  ensureKonnecctModuleFederationHost,
  KONNECCT_PLANE_REMOTE_NAME,
} from '@/projects/utils/konnecctModuleFederationHost';

/** Browser URL prefix (Twenty shell). */
const USER_PROJECTS_PREFIX = '/projects';
/**
 * Same-origin mount for Plane behind nginx (stripped to proxy root).
 * Must match nginx `location /_konnecct/plane/` and the Plane web bundle public path.
 */
const INTERNAL_PLANE_PATH = '/_konnecct/plane';

/** Stock makeplane images serve `/assets/` at the site root; on app.* that collides with Twenty. */
const DEFAULT_PLANE_PRODUCTION_URL = 'https://projects.konnecct.com';

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
      iframeBase: DEFAULT_PLANE_PRODUCTION_URL,
      syncPathPrefix: null,
    };
  }
  return null;
};

type FederatedPlaneProps = Record<string, unknown>;

/**
 * Konnecct Projects: prefers Module Federation (true single-document micro-frontend)
 * when Plane ships `remoteEntry.js` exposing `REACT_APP_PLANE_MF_MODULE`.
 *
 * Plane fork (apps/web): add @module-federation/vite with
 * `name: 'konnecct_plane'`, `filename: 'remoteEntry.js'`,
 * `exposes: { './KonnecctShell': './src/konnecct-shell.tsx' }`,
 * `shared: { react: { singleton: true }, 'react-dom': { singleton: true } }`,
 * and export a default React component from konnecct-shell that renders your app root
 * (with router basename `/_konnecct/plane` or props from this host).
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

  const remoteEntryUrl = resolved
    ? `${resolved.iframeBase.replace(/\/$/, '')}/remoteEntry.js`
    : '';

  const iframeSrc =
    resolved === null
      ? ''
      : `${resolved.iframeBase.replace(/\/$/, '')}${suffixFromUserProjectsPath(location.pathname)}`;

  const pathSuffix = suffixFromUserProjectsPath(location.pathname);

  const [federated, setFederated] = useState<ComponentType<FederatedPlaneProps> | null>(
    null,
  );
  const [federationFailed, setFederationFailed] = useState(false);
  const [federationError, setFederationError] = useState<string | null>(null);

  const mfBlockedBySession =
    embedMode === 'auto' &&
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem(MF_SESSION_FAIL) === '1';

  const sameOriginPlaneHost =
    typeof window !== 'undefined' &&
    resolved !== null &&
    resolved.iframeBase.startsWith(window.location.origin);

  const showIframe =
    embedMode === 'iframe' ||
    mfBlockedBySession ||
    (embedMode === 'auto' && federationFailed) ||
    (embedMode === 'auto' && resolved !== null && !sameOriginPlaneHost);

  const showFederated =
    Boolean(federated) && embedMode !== 'iframe' && !mfBlockedBySession;

  const tryFederation =
    embedMode !== 'iframe' &&
    resolved &&
    !mfBlockedBySession &&
    sameOriginPlaneHost;

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
        const mod = await loadRemote<
          ComponentType<FederatedPlaneProps> | { default: ComponentType<FederatedPlaneProps> }
        >(mfModuleId);
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
    embedMode,
  ]);

  useEffect(() => {
    const syncPathPrefix = resolved?.syncPathPrefix;
    if (syncPathPrefix === null || syncPathPrefix === undefined || !showIframe) {
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
        const target = userPathFromPlanePathname(iframePath, syncPathPrefix);
        if (target !== null && target !== location.pathname) {
          navigate(target, { replace: true });
        }
      } catch {
        /* cross-origin */
      }
    }, 400);

    return () => window.clearInterval(id);
  }, [resolved?.syncPathPrefix, location.pathname, navigate, showIframe]);

  if (!resolved) {
    return (
      <StyledShell>
        <StyledPlaceholder>
          {t`Set REACT_APP_PLANE_WEB_URL to your Plane web URL (required on localhost). In production the default is projects.* so Plane assets do not clash with the CRM.`}
        </StyledPlaceholder>
      </StyledShell>
    );
  }

  if (embedMode === 'federation' && !sameOriginPlaneHost) {
    return (
      <StyledShell>
        <StyledPlaceholder>
          {t`REACT_APP_PLANE_EMBED=federation only works with a same-origin Plane build (e.g. REACT_APP_PLANE_WEB_URL=https://app…/_konnecct/plane with remoteEntry.js). Use REACT_APP_PLANE_EMBED=auto or set REACT_APP_PLANE_WEB_URL to the dedicated Plane host.`}
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
              konnecctPathSuffix={pathSuffix}
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
            konnecctPathSuffix={pathSuffix}
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
