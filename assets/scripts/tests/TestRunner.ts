/**
 * Simple Test Runner cho Cocos Creator TypeScript
 * Không cần Jest/Mocha, chạy trong Editor hoặc Runtime.
 * Kết quả log ra console.
 */

export interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

export class TestRunner {
    private _results: TestResult[] = [];
    private _currentSuite: string = '';

    public describe(suiteName: string, fn: () => void): void {
        this._currentSuite = suiteName;
        fn();
        this._currentSuite = '';
    }

    public it(testName: string, fn: () => void): void {
        const fullName = this._currentSuite ? `${this._currentSuite}: ${testName}` : testName;
        try {
            fn();
            this._results.push({ name: fullName, passed: true });
        } catch (e: any) {
            this._results.push({ name: fullName, passed: false, error: e.message });
        }
    }

    public assert(condition: boolean, message?: string): void {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    public assertEquals(actual: any, expected: any, message?: string): void {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected} but got ${actual}`);
        }
    }

    public assertTrue(condition: boolean, message?: string): void {
        this.assert(condition, message || 'Expected true but got false');
    }

    public assertFalse(condition: boolean, message?: string): void {
        this.assert(!condition, message || 'Expected false but got true');
    }

    public assertThrows(fn: () => void, message?: string): void {
        let threw = false;
        try { fn(); } catch (e) { threw = true; }
        this.assert(threw, message || 'Expected function to throw');
    }

    public printReport(): void {
        const total = this._results.length;
        const passed = this._results.filter(r => r.passed).length;
        const failed = total - passed;

        console.log(`\n========== TEST REPORT ==========`);
        console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}\n`);

        for (const r of this._results) {
            if (r.passed) {
                console.log(`[PASS] ${r.name}`);
            } else {
                console.error(`[FAIL] ${r.name}`);
                console.error(`       ${r.error}`);
            }
        }

        console.log(`\n=================================`);
        if (failed === 0) {
            console.log('ALL TESTS PASSED!');
        } else {
            console.error(`${failed} TEST(S) FAILED!`);
        }
    }

    public getResults(): TestResult[] {
        return [...this._results];
    }

    public clear(): void {
        this._results = [];
    }
}
