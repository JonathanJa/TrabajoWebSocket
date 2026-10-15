<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->useCompiledAssetsOutsideLocal();
    }

    /**
     * When the app is reached through a tunnel (e.g. Cloudflare) the request
     * host is public, but the Vite dev server only listens on localhost. A
     * remote browser can never load http://127.0.0.1:5173, so the page stays
     * blank. In that case we ignore the dev-server "hot" file and serve the
     * compiled assets from public/build instead (run `npm run build`).
     */
    protected function useCompiledAssetsOutsideLocal(): void
    {
        if (app()->runningInConsole()) {
            return;
        }

        $host = request()->getHost();

        $isLocal = in_array($host, ['localhost', '127.0.0.1', '::1'], true)
            || str_ends_with($host, '.test')
            || str_ends_with($host, '.localhost');

        if ($isLocal) {
            return;
        }

        // This path intentionally does not exist, so Vite::isRunningHot() is
        // false and the build manifest in public/build is used.
        Vite::useHotFile(storage_path('framework/vite.hot'));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
