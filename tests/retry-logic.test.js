/**
 * Tests za retry mehanizam s exponential backoff
 * Izvor: js/app.js linije 332-409 (fetchWithCache) i linije 886-904 (loadPoslovodjaRadilistaMapping)
 *
 * Retry pravila:
 * - MAX_RETRIES = 3
 * - Backoff: attempt * 2000ms (2s, 4s)
 * - Ne retry na AbortError (timeout)
 * - Fallback na stale cache ako svi pokusaji propadnu
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ===== EXTRACTOVANA RETRY LOGIKA IZ app.js =====
// Pojednostavljena verzija bez fetch/cache zavisnosti
// Delay se moze overridovati za brze testiranje

async function withRetry(operation, options = {}) {
    const MAX_RETRIES = options.maxRetries || 3;
    const delayFn = options.delayFn || ((attempt) => attempt * 2000);
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await operation(attempt);
        } catch (error) {
            lastError = error;

            // Ne retry na AbortError (timeout)
            if (error.name === 'AbortError') {
                throw error;
            }

            if (attempt < MAX_RETRIES) {
                const delay = delayFn(attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// Fast options za testiranje (bez stvarnih kaSnjenja)
const FAST_OPTIONS = { delayFn: () => 0 };

// ===== TESTOVI =====

describe('Retry mehanizam', () => {

    describe('Uspjesni scenariji', () => {
        test('Uspjesan prvi pokusaj - nema retry', async () => {
            let attemptCount = 0;
            const result = await withRetry(async (attempt) => {
                attemptCount = attempt;
                return 'success';
            }, FAST_OPTIONS);

            assert.equal(result, 'success');
            assert.equal(attemptCount, 1, 'Trebao bi biti samo jedan pokusaj');
        });

        test('Uspjesan drugi pokusaj (prvi fail)', async () => {
            let attemptCount = 0;
            const result = await withRetry(async (attempt) => {
                attemptCount = attempt;
                if (attempt === 1) throw new Error('Network error');
                return 'success-on-retry';
            }, FAST_OPTIONS);

            assert.equal(result, 'success-on-retry');
            assert.equal(attemptCount, 2);
        });

        test('Uspjesan treci pokusaj (dva faila)', async () => {
            let attemptCount = 0;
            const result = await withRetry(async (attempt) => {
                attemptCount = attempt;
                if (attempt < 3) throw new Error('Transient error');
                return 'success-on-third';
            }, FAST_OPTIONS);

            assert.equal(result, 'success-on-third');
            assert.equal(attemptCount, 3);
        });
    });

    describe('Neuspjesni scenariji', () => {
        test('Svi pokusaji neuspjesni - baca zadnju gresku', async () => {
            let attemptCount = 0;
            await assert.rejects(async () => {
                await withRetry(async (attempt) => {
                    attemptCount = attempt;
                    throw new Error(`Error on attempt ${attempt}`);
                }, FAST_OPTIONS);
            }, (error) => {
                assert.ok(error.message.includes('3'), 'Greska treba biti sa zadnjeg pokusaja');
                return true;
            });

            assert.equal(attemptCount, 3, 'Trebao bi biti tacno 3 pokusaja');
        });

        test('Max pokusaja je 3', async () => {
            let attemptCount = 0;
            try {
                await withRetry(async (attempt) => {
                    attemptCount = attempt;
                    throw new Error('Always fails');
                }, FAST_OPTIONS);
            } catch (e) {
                // Ocekivana greska
            }
            assert.equal(attemptCount, 3, 'Ne smije biti vise od 3 pokusaja');
        });
    });

    describe('AbortError - bez retry', () => {
        test('AbortError se ne retry-a', async () => {
            let attemptCount = 0;
            const abortError = new DOMException('Request timed out', 'AbortError');

            await assert.rejects(async () => {
                await withRetry(async (attempt) => {
                    attemptCount = attempt;
                    throw abortError;
                }, FAST_OPTIONS);
            });

            assert.equal(attemptCount, 1, 'AbortError treba odmah propagirati bez retry-a');
        });
    });

    describe('Exponential backoff timing', () => {
        test('Delay se povecava po pokuSajima (2s, 4s obrazac)', async () => {
            const delays = [];
            const trackingOptions = {
                delayFn: (attempt) => {
                    const delay = attempt * 2000;
                    delays.push(delay);
                    return 0; // Koristimo 0ms za brze testiranje
                }
            };

            try {
                await withRetry(async () => {
                    throw new Error('Always fails');
                }, trackingOptions);
            } catch (e) {
                // Ocekivana greska
            }

            assert.equal(delays.length, 2, 'Treba biti 2 delay-a (izmedju 3 pokusaja)');
            assert.equal(delays[0], 2000, 'Prvi delay: 1 * 2000 = 2s');
            assert.equal(delays[1], 4000, 'Drugi delay: 2 * 2000 = 4s');
        });
    });

    describe('Razliciti tipovi gresaka', () => {
        test('Network error se retry-a', async () => {
            let count = 0;
            const result = await withRetry(async (attempt) => {
                count++;
                if (attempt === 1) {
                    const err = new TypeError('Failed to fetch');
                    err.name = 'TypeError';
                    throw err;
                }
                return 'recovered';
            }, FAST_OPTIONS);

            assert.equal(result, 'recovered');
            assert.equal(count, 2);
        });

        test('QUIC protocol error se retry-a', async () => {
            let count = 0;
            const result = await withRetry(async (attempt) => {
                count++;
                if (attempt <= 2) {
                    throw new Error('ERR_QUIC_PROTOCOL_ERROR');
                }
                return 'recovered-from-quic';
            }, FAST_OPTIONS);

            assert.equal(result, 'recovered-from-quic');
            assert.equal(count, 3);
        });
    });

    describe('Custom maxRetries', () => {
        test('maxRetries=1 - samo jedan pokusaj', async () => {
            let count = 0;
            try {
                await withRetry(async () => {
                    count++;
                    throw new Error('fail');
                }, { ...FAST_OPTIONS, maxRetries: 1 });
            } catch (e) {
                // Ocekivano
            }
            assert.equal(count, 1);
        });

        test('maxRetries=5 - pet pokusaja', async () => {
            let count = 0;
            try {
                await withRetry(async () => {
                    count++;
                    throw new Error('fail');
                }, { ...FAST_OPTIONS, maxRetries: 5 });
            } catch (e) {
                // Ocekivano
            }
            assert.equal(count, 5);
        });
    });

});
