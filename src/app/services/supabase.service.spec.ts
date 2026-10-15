import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';
// `vi.mock` se iza al tope del módulo; con `vi.hoisted` el factory del mock y los
// tests comparten las mismas referencias (el espía y el cliente de mentira).
const { createClientMock, fakeClient } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fakeClient: { __fake: 'supabase-client' },
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));
describe('SupabaseService', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    createClientMock.mockReturnValue(fakeClient);
  });
  it('es inyectable (providedIn: root) y expone el cliente que devuelve createClient', () => {
    const service = TestBed.inject(SupabaseService);
    expect(service).toBeInstanceOf(SupabaseService);
    expect(service.client).toBe(fakeClient);
  });
  it('crea el cliente con la url y la key (publishable) de environment', () => {
    TestBed.inject(SupabaseService);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key] = createClientMock.mock.calls[0];
    expect(url).toBe(environment.supabase.url);
    expect(key).toBe(environment.supabase.key);
  });
  it('configura el cliente SSR-safe (persistSession/autoRefreshToken/detectSessionInUrl en false)', () => {
    TestBed.inject(SupabaseService);
    const options = createClientMock.mock.calls[0][2];
    expect(options.auth).toEqual({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });
});
