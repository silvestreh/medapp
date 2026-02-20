import React, { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useNavigate } from '@remix-run/react';
import type { Application, Params, ServiceMethods } from '@feathersjs/feathers';
import omit from 'lodash/omit';
import useSWR, { SWRConfig, type SWRConfiguration, mutate } from 'swr';
import sift from 'sift';

import type { Account } from '~/declarations';
import createFeathersClient from '~/feathers';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface FeathersContextType {
  client: Application | null;
  initialUser?: Account | null;
}

interface UseAccountReturn {
  user?: Account | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const FeathersContext = createContext<FeathersContextType | undefined>(undefined);

interface FeathersProviderProps extends PropsWithChildren {
  initialToken?: string;
  initialUser?: Account | null;
  apiUrl?: string;
  swrConfig?: SWRConfiguration;
}

export const FeathersProvider: React.FC<FeathersProviderProps> = ({
  children,
  initialToken,
  initialUser,
  apiUrl = process.env.API_URL ?? 'http://localhost:3030',
  swrConfig = { dedupingInterval: 2000 },
}) => {
  const [feathersClient, setFeathersClient] = useState<Application | null>(null);

  useEffect(() => {
    const client = createFeathersClient(apiUrl, initialToken);
    setFeathersClient(client);
  }, [initialToken, apiUrl]);

  return (
    <SWRConfig value={swrConfig}>
      <FeathersContext.Provider value={{ client: feathersClient, initialUser }}>{children}</FeathersContext.Provider>
    </SWRConfig>
  );
};

export const useFeathers = (): Application => {
  const context = useContext(FeathersContext);

  if (!context) {
    throw new Error('useFeathers must be used within a FeathersProvider');
  }

  return context.client!;
};

export const useAccount = (): UseAccountReturn => {
  const context = useContext(FeathersContext);
  const [user, setUser] = useState<Account | null | undefined>(context?.initialUser);
  const navigate = useNavigate();
  const client = useFeathers();

  useEffect(() => {
    if (typeof window === 'undefined' || !client) return;

    client
      .reAuthenticate()
      .then(response => {
        setUser(response.user);
      })
      .catch(() => {
        setUser(null);
      });
  }, [client]);

  const login = async (username: string, password: string) => {
    const response = await client.authenticate({
      strategy: 'local',
      username,
      password,
    });
    setUser(response.user);
  };

  const logout = async () => {
    await client.logout();
    await fetch('/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  };

  return {
    user,
    login,
    logout,
  };
};

const fetcher = (
  [serviceName, method, ...args]: [string, keyof ServiceMethods<any>, ...any[]],
  feathersClient: Application
) => {
  const service = feathersClient.service(serviceName);

  if (method === 'get') {
    return service.get(args[0], args[1]);
  }

  if (method in service) {
    return (service[method] as (...args: any[]) => any)(...args);
  }

  throw new Error(`Method ${method} not found on service ${serviceName}`);
};

export const useFind = (
  serviceName: string,
  query?: Params['query'],
  params?: Omit<Params, 'query'> & { [key: string]: any },
  initialData?: any[]
) => {
  const feathersClient = useFeathers();
  const stableQuery = useMemo(() => query, [query]);
  const stableParams = useMemo(() => omit(params, 'query'), [params]);

  const {
    data,
    error,
    mutate: swrMutate,
  } = useSWR(
    stableParams.enabled !== false
      ? [serviceName, 'find' as keyof ServiceMethods<any>, { query: stableQuery, ...stableParams }]
      : null,
    args => fetcher(args, feathersClient)
  );

  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (stableParams.enabled === false) {
      setStatus('idle');
      return;
    }
    if (!data && !error) {
      setStatus('loading');
    } else if (error) {
      setStatus('error');
    } else {
      setStatus('success');
    }
  }, [data, error, stableParams.enabled]);

  useEffect(() => {
    if (!feathersClient) return;

    const service = feathersClient.service(serviceName);
    const handleCreated = (item: any) => {
      if (sift(stableQuery)(item)) {
        swrMutate((currentData: any) => {
          if (Array.isArray(currentData)) {
            return [...currentData, item];
          }
          return {
            ...currentData,
            data: [...currentData.data, item],
          };
        }, false);
      }
    };

    const handleUpdated = (item: any) => {
      if (sift(stableQuery)(item)) {
        swrMutate((currentData: any) => {
          if (Array.isArray(currentData)) {
            return currentData.map((dataItem: any) => (dataItem.id === item.id ? item : dataItem));
          }
          return {
            ...currentData,
            data: currentData.data.map((dataItem: any) => (dataItem.id === item.id ? item : dataItem)),
          };
        }, false);
      }
    };

    const handlePatched = handleUpdated;

    const handleRemoved = (item: any) => {
      swrMutate((currentData: any) => {
        if (Array.isArray(currentData)) {
          return currentData.filter((dataItem: any) => dataItem.id !== item.id);
        }
        return {
          ...currentData,
          data: currentData?.data.filter((dataItem: any) => dataItem.id !== item.id),
        };
      }, false);
    };

    service.on('created', handleCreated);
    service.on('updated', handleUpdated);
    service.on('patched', handlePatched);
    service.on('removed', handleRemoved);

    return () => {
      service.off('created', handleCreated);
      service.off('updated', handleUpdated);
      service.off('patched', handlePatched);
      service.off('removed', handleRemoved);
    };
  }, [feathersClient, serviceName, stableQuery, swrMutate]);

  return {
    response: data || (params?.paginate ? { data: initialData || [] } : initialData || []),
    isLoading: status === 'loading',
    error,
    status,
  };
};

export const useGet = (serviceName: string, id: string, params?: Params & { enabled?: boolean }) => {
  const feathersClient = useFeathers();
  const {
    data,
    error,
    mutate: swrMutate,
  } = useSWR(
    params?.enabled !== false && id ? [serviceName, 'get' as keyof ServiceMethods<any>, id, params] : null,
    args => fetcher(args, feathersClient)
  );

  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (params?.enabled === false || !id) {
      setStatus('idle');
      return;
    }
    if (!data && !error) {
      setStatus('loading');
    } else if (error) {
      setStatus('error');
    } else {
      setStatus('success');
    }
  }, [data, error, params?.enabled, id]);

  useEffect(() => {
    if (!feathersClient) return;

    const service = feathersClient.service(serviceName);
    const handleUpdated = (item: any) => {
      if (item.id === id) {
        swrMutate(item, false);
      }
    };

    const handlePatched = (item: any) => {
      if (item.id === id) {
        swrMutate(item, false);
      }
    };

    const handleRemoved = (item: any) => {
      if (item.id === id) {
        swrMutate(null, false);
      }
    };

    service.on('updated', handleUpdated);
    service.on('patched', handlePatched);
    service.on('removed', handleRemoved);

    return () => {
      service.off('updated', handleUpdated);
      service.off('patched', handlePatched);
      service.off('removed', handleRemoved);
    };
  }, [feathersClient, serviceName, id, swrMutate]);

  return {
    data: data || {},
    isLoading: status === 'loading',
    error,
    status,
  };
};

export const useMutation = (serviceName: string) => {
  const feathersClient = useFeathers();
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  const mutateData = async (method: keyof ServiceMethods<any>, ...args: any[]) => {
    setStatus('loading');
    try {
      const result = await (feathersClient.service(serviceName)[method] as (...args: any[]) => any)(...args);
      setData(result);
      setStatus('success');
      mutate([serviceName, 'find']);
      mutate([serviceName, 'get', args[0]]);
      return result;
    } catch (err) {
      setError(err);
      setStatus('error');
      throw err;
    }
  };

  return {
    data,
    status,
    error,
    isLoading: status === 'loading',
    create: (data: any, params?: Params) => mutateData('create', data, params),
    update: (id: string, data: any, params?: Params) => mutateData('update', id, data, params),
    patch: (id: string, data: any, params?: Params) => mutateData('patch', id, data, params),
    remove: (id: string, params?: Params) => mutateData('remove', id, params),
  };
};
