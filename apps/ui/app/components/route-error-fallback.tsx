import { isRouteErrorResponse, useNavigate, useRouteError } from '@remix-run/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { captureRemixErrorBoundaryError } from '@sentry/remix';
import { Alert, Button, Stack, Text, Code } from '@mantine/core';
import { WarningIcon } from '@phosphor-icons/react';

export default function RouteErrorFallback() {
  const { t } = useTranslation();
  const error = useRouteError();
  const navigate = useNavigate();

  captureRemixErrorBoundaryError(error);

  const is404 = isRouteErrorResponse(error) && error.status === 404;

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <Stack align="center" justify="center" py="xl" mih={200}>
      <Alert
        icon={<WarningIcon size={18} />}
        title={t('common.something_went_wrong')}
        color="red"
        variant="light"
        maw={480}
        w="100%"
      >
        <Stack gap="sm">
          <Text size="sm">
            {is404 ? t('common.error_not_found') : t('common.error_unexpected')}
          </Text>

          {process.env.NODE_ENV !== 'production' && error && (
            <Code block style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
              {isRouteErrorResponse(error)
                ? `${error.status} ${error.statusText}`
                : error instanceof Error
                  ? error.message
                  : JSON.stringify(error, null, 2)}
            </Code>
          )}

          <Button variant="light" color="gray" size="xs" onClick={handleGoBack} mt="xs" w="fit-content">
            {t('common.error_go_back')}
          </Button>
        </Stack>
      </Alert>
    </Stack>
  );
}
