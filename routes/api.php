<?php

use App\Http\Controllers\Api\AiChatController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\HrPercoController;
use App\Http\Controllers\Api\LibraryReservationController;
use App\Http\Controllers\Api\NavigationRouteController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('admin/login', [AdminAuthController::class, 'login']);
Route::post('login', [AuthController::class, 'login']);

Route::get('announcements', [AnnouncementController::class, 'index']);
Route::get('announcements/{announcement}', [AnnouncementController::class, 'show']);
Route::get('nav/routes', [NavigationRouteController::class, 'index']);
Route::get('nav/routes/{navigationRoute}', [NavigationRouteController::class, 'show']);
Route::post('tickets', [TicketController::class, 'store']);
Route::post('library/reservations', [LibraryReservationController::class, 'store']);
Route::post('ai/chat', [AiChatController::class, 'chat']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('departments', [DepartmentController::class, 'index']);

    Route::post('announcements', [AnnouncementController::class, 'store']);
    Route::patch('announcements/{announcement}', [AnnouncementController::class, 'update']);
    Route::delete('announcements/{announcement}', [AnnouncementController::class, 'destroy']);

    Route::get('admin/tickets', [TicketController::class, 'index']);
    Route::get('admin/tickets/{ticket}', [TicketController::class, 'show']);
    Route::patch('admin/tickets/{ticket}', [TicketController::class, 'update']);
    Route::post('tickets/{ticket}/accept', [TicketController::class, 'accept']);

    Route::get('admin/library/reservations', [LibraryReservationController::class, 'index']);
    Route::get('admin/library/reservations/{reservation}', [LibraryReservationController::class, 'show']);
    Route::post('admin/library/reservations/{reservation}/approve', [LibraryReservationController::class, 'approve']);
    Route::post('admin/library/reservations/{reservation}/reject', [LibraryReservationController::class, 'reject']);

    Route::post('admin/nav/routes', [NavigationRouteController::class, 'store']);
    Route::patch('admin/nav/routes/{navigationRoute}', [NavigationRouteController::class, 'update']);
    Route::delete('admin/nav/routes/{navigationRoute}', [NavigationRouteController::class, 'destroy']);

    Route::get('admin/users', [UserController::class, 'index']);
    Route::get('hr/perco', [HrPercoController::class, 'index']);
});
