import { AuthModal } from '@/auth/components/AuthModal';
import { AppErrorBoundary } from '@/error-handler/components/AppErrorBoundary';
import { AppFullScreenErrorFallback } from '@/error-handler/components/AppFullScreenErrorFallback';
import { AppPageErrorFallback } from '@/error-handler/components/AppPageErrorFallback';
import { FileUploadProvider } from '@/file-upload/components/FileUploadProvider';
import { KeyboardShortcutMenu } from '@/keyboard-shortcut-menu/components/KeyboardShortcutMenu';
import { LayoutCustomizationBar } from '@/layout-customization/components/LayoutCustomizationBar';
import { MobileNavigationBar } from '@/navigation/components/MobileNavigationBar';
import { PageDragDropProvider } from '@/navigation-menu-item/display/dnd/providers/PageDragDropProvider';
import { SignInAppNavigationDrawerMock } from '@/sign-in-background-mock/components/SignInAppNavigationDrawerMock';
import { Suspense, lazy, useContext } from 'react';

const SignInBackgroundMockPage = lazy(() =>
  import('@/sign-in-background-mock/components/SignInBackgroundMockPage').then(
    (module) => ({ default: module.SignInBackgroundMockPage }),
  ),
);
import { useShowAuthModal } from '@/ui/layout/hooks/useShowAuthModal';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { styled } from '@linaria/react';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { CallOverlayProvider } from '@/chat/contexts/CallOverlayContext';
import { GlobalCallOverlay } from '@/chat/components/GlobalCallOverlay';

const StyledLayout = styled.div`
  background: ${themeCssVariables.background.noisy};
  display: flex;
  flex-direction: column;
  height: 100dvh;
  position: relative;
  scrollbar-color: ${themeCssVariables.border.color.medium} transparent;
  scrollbar-width: 4px;
  width: 100%;

  *::-webkit-scrollbar-thumb {
    border-radius: ${themeCssVariables.border.radius.sm};
  }
`;

const StyledPageContainerBase = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: row;
  min-height: 0;
`;
const StyledPageContainer = motion.create(StyledPageContainerBase);

const StyledNavigationDrawerWrapper = styled.div`
  flex-shrink: 0;
`;

const StyledMainContainer = styled.div`
  display: flex;
  flex: 1 1 100%;
  min-width: 0;
  overflow: hidden;
`;

/**
 * Layout for the Sendbird Communications hub (/chat routes).
 * Provides CallOverlayProvider so the floating call dock persists across navigation.
 * No separate CRM navigation drawer — the Sendbird hub renders its own sidebar rail.
 */
export const ChatEmbedLayout = () => {
  const isMobile = useIsMobile();
  const showAuthModal = useShowAuthModal();
  const { pathname } = useLocation();
  const { theme } = useContext(ThemeContext);
  const isNativeChatRoute =
    pathname === '/chat' ||
    pathname.startsWith('/chat/c/') ||
    pathname.startsWith('/chat/dm/');

  return (
    <>
      <CallOverlayProvider>
        <FileUploadProvider>
          <StyledLayout>
            <AppErrorBoundary FallbackComponent={AppFullScreenErrorFallback}>
              <LayoutCustomizationBar />
              <StyledPageContainer
                animate={{ marginLeft: 0 }}
                transition={{
                  duration:
                    typeof theme.animation.duration.normal === 'number' &&
                    !Number.isNaN(theme.animation.duration.normal)
                      ? theme.animation.duration.normal
                      : 0.2,
                }}
              >
                <PageDragDropProvider>
                  {!showAuthModal && !isNativeChatRoute ? (
                    <KeyboardShortcutMenu />
                  ) : null}
                  {showAuthModal ? (
                    <>
                      <StyledNavigationDrawerWrapper>
                        <SignInAppNavigationDrawerMock />
                      </StyledNavigationDrawerWrapper>
                      <StyledMainContainer>
                        <Suspense fallback={null}>
                          <SignInBackgroundMockPage />
                        </Suspense>
                      </StyledMainContainer>
                      <AnimatePresence mode="wait">
                        <LayoutGroup>
                          <AuthModal>
                            <Outlet />
                          </AuthModal>
                        </LayoutGroup>
                      </AnimatePresence>
                    </>
                  ) : (
                    <StyledMainContainer>
                      <AppErrorBoundary FallbackComponent={AppPageErrorFallback}>
                        <Outlet />
                      </AppErrorBoundary>
                    </StyledMainContainer>
                  )}
                </PageDragDropProvider>
              </StyledPageContainer>
              {isMobile && !showAuthModal && <MobileNavigationBar />}
            </AppErrorBoundary>
          </StyledLayout>
        </FileUploadProvider>
        {/* Persistent call dock — renders over all routes inside this layout */}
        <GlobalCallOverlay />
      </CallOverlayProvider>
    </>
  );
};
