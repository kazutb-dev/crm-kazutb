<?php

use App\Http\Controllers\Api\AiChatController;
use App\Http\Controllers\Api\AccessSummaryController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Questionnaire\AdminDictionaryController;
use App\Http\Controllers\Api\Questionnaire\AdminSurveyResultController;
use App\Http\Controllers\Api\Questionnaire\StudentSurveyController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\HrPercoController;
use App\Http\Controllers\Api\LibraryReservationController;
use App\Http\Controllers\Api\NavigationRouteController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('admin/login', [AdminAuthController::class, 'login'])
    ->middleware('throttle:login');
Route::post('login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::get('announcements', [AnnouncementController::class, 'index']);
Route::get('announcements/{announcement}', [AnnouncementController::class, 'show']);
Route::get('nav/routes', [NavigationRouteController::class, 'index']);
Route::get('nav/routes/{navigationRoute}', [NavigationRouteController::class, 'show']);
Route::post('tickets', [TicketController::class, 'store'])
    ->middleware('throttle:20,1');
Route::post('library/reservations', [LibraryReservationController::class, 'store'])
    ->middleware('throttle:20,1');
Route::post('ai/chat', [AiChatController::class, 'chat'])
    ->middleware('throttle:20,1');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('me', [AuthController::class, 'me']);
    Route::get('me/access-summary', [AccessSummaryController::class, 'show']);
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

    Route::prefix('questionnaire')->group(function (): void {
        Route::get('student/surveys', [StudentSurveyController::class, 'index']);
        Route::post('student/surveys/submit', [StudentSurveyController::class, 'store']);
        Route::get('admin/results', [AdminSurveyResultController::class, 'index']);

        Route::prefix('admin')->group(function (): void {
            Route::get('students', [AdminDictionaryController::class, 'studentsIndex']);
            Route::get('students/ad-search', [AdminDictionaryController::class, 'studentsAdSearch']);
            Route::post('students', [AdminDictionaryController::class, 'studentsStore']);
            Route::patch('students/{student}', [AdminDictionaryController::class, 'studentsUpdate']);
            Route::delete('students/{student}', [AdminDictionaryController::class, 'studentsDestroy']);

            Route::get('teachers', [AdminDictionaryController::class, 'teachersIndex']);

            Route::get('teacher-disciplines', [AdminDictionaryController::class, 'teacherDisciplinesIndex']);
            Route::post('teacher-disciplines', [AdminDictionaryController::class, 'teacherDisciplinesStore']);
            Route::patch('teacher-disciplines/{teacherDiscipline}', [AdminDictionaryController::class, 'teacherDisciplinesUpdate']);
            Route::delete('teacher-disciplines/{teacherDiscipline}', [AdminDictionaryController::class, 'teacherDisciplinesDestroy']);

            Route::get('group-disciplines', [AdminDictionaryController::class, 'groupDisciplinesIndex']);
            Route::post('group-disciplines', [AdminDictionaryController::class, 'groupDisciplinesStore']);
            Route::patch('group-disciplines/{groupDiscipline}', [AdminDictionaryController::class, 'groupDisciplinesUpdate']);
            Route::delete('group-disciplines/{groupDiscipline}', [AdminDictionaryController::class, 'groupDisciplinesDestroy']);

            Route::get('groups', [AdminDictionaryController::class, 'groupsIndex']);
            Route::post('groups', [AdminDictionaryController::class, 'groupsStore']);
            Route::patch('groups/{group}', [AdminDictionaryController::class, 'groupsUpdate']);
            Route::delete('groups/{group}', [AdminDictionaryController::class, 'groupsDestroy']);

            Route::get('specialities', [AdminDictionaryController::class, 'specialitiesIndex']);
            Route::post('specialities', [AdminDictionaryController::class, 'specialitiesStore']);
            Route::patch('specialities/{speciality}', [AdminDictionaryController::class, 'specialitiesUpdate']);
            Route::delete('specialities/{speciality}', [AdminDictionaryController::class, 'specialitiesDestroy']);

            Route::get('educational-programs', [AdminDictionaryController::class, 'educationalProgramsIndex']);
            Route::post('educational-programs', [AdminDictionaryController::class, 'educationalProgramsStore']);
            Route::patch('educational-programs/{educationalProgram}', [AdminDictionaryController::class, 'educationalProgramsUpdate']);
            Route::delete('educational-programs/{educationalProgram}', [AdminDictionaryController::class, 'educationalProgramsDestroy']);

            Route::get('disciplines', [AdminDictionaryController::class, 'disciplinesIndex']);
            Route::post('disciplines', [AdminDictionaryController::class, 'disciplinesStore']);
            Route::patch('disciplines/{discipline}', [AdminDictionaryController::class, 'disciplinesUpdate']);
            Route::delete('disciplines/{discipline}', [AdminDictionaryController::class, 'disciplinesDestroy']);

            Route::get('surveys', [AdminDictionaryController::class, 'surveysIndex']);
            Route::post('surveys', [AdminDictionaryController::class, 'surveysStore']);
            Route::patch('surveys/{survey}', [AdminDictionaryController::class, 'surveysUpdate']);
            Route::delete('surveys/{survey}', [AdminDictionaryController::class, 'surveysDestroy']);

            Route::get('questions', [AdminDictionaryController::class, 'questionsIndex']);
            Route::post('questions', [AdminDictionaryController::class, 'questionsStore']);
            Route::patch('questions/{question}', [AdminDictionaryController::class, 'questionsUpdate']);
            Route::delete('questions/{question}', [AdminDictionaryController::class, 'questionsDestroy']);

            Route::get('options', [AdminDictionaryController::class, 'optionsIndex']);
            Route::post('options', [AdminDictionaryController::class, 'optionsStore']);
            Route::patch('options/{option}', [AdminDictionaryController::class, 'optionsUpdate']);
            Route::delete('options/{option}', [AdminDictionaryController::class, 'optionsDestroy']);
        });
    });
});

Route::middleware('testing.api.key')->prefix('testing')->group(function () {
    Route::get('subjects', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'subjects']);
    Route::get('subjects/{subjectId}/teachers', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'teachers']);
    Route::post('student-bindings', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'storeStudentBinding']);
    Route::get('student-bindings/{studentId}', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'getStudentBindings']);
    Route::get('tests', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'tests']);
    Route::get('tests/{testId}', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'showTest']);
    Route::post('tests/{testId}/submit', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'submitTest']);
    Route::get('results/{studentId}', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'studentResults']);
    Route::get('analytics/{bindingId}', [\App\Http\Controllers\Api\Testing\TestingApiController::class, 'analytics']);
});
